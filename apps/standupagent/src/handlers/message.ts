import { ChatPrompt } from "@microsoft/teams.ai";
import { IMessageActivity, MentionEntity } from "@microsoft/teams.api";
import { executeRegister } from "../commands/register";
import { executeCloseStandup, executeStartStandup } from "../commands/standup";
import { CommandContext } from "../commands/types";
import {
    executeAddUsers,
    executeGroupDetails,
    executeRemoveUsers,
} from "../commands/users";
import {
    createHistoricalStandupsCard,
    createParkingLotCard,
} from "../models/AdaptiveCards";
import { StandupCoordinator } from "../models/StandupCoordinator";
import { registerGroupChatFunctions, registerPersonalChatFunctions } from "./nlpFunctions";
import { buildChatPromptModel } from "../utils/chatPromptModel";

export async function handleMessage(
    activity: IMessageActivity,
    partialContext: Omit<
        CommandContext,
        | "mentions"
        | "activity"
        | "conversationId"
        | "userId"
        | "userName"
        | "tenantId"
    >,
    standup: StandupCoordinator
) {
    if (activity.text == null) {
        return;
    }

    // Detect conversation type
    const isGroupChat = activity.conversation.conversationType !== "personal";

    // Initialize ChatPrompt with context-specific instructions
    const instructions = isGroupChat
        ? "You are a Standup Agent for managing team standups. You can register groups, manage users, start/close standups, and handle parking lot items for group standup sessions."
        : "You are a Standup Agent for personal standup management. You can help manage your standup settings, track daily work, and view your personal standup history across teams.";

    const nlpPrompt = new ChatPrompt({
        instructions,
        model: buildChatPromptModel()
    });

    const mentions = activity.entities
        ?.filter((e: any): e is MentionEntity => {
            return e.type === "mention" && e.mentioned.role !== "bot";
        })
        .map((mention: MentionEntity) => ({
            id: mention.mentioned?.id || "",
            name: mention.mentioned?.name || "",
        }));

    const context: CommandContext = {
        ...partialContext,
        conversationId: activity.conversation.id,
        userId: activity.from.id,
        userName: activity.from.name,
        mentions: mentions || [],
        tenantId: activity.conversation.tenantId || "unknown",
    };

    const text = activity.text.toLowerCase().trim();

    if (text.startsWith("!")) {
        console.log("Exact command detected ", text);
        // Handle direct commands with existing string matching
        if (text.includes("!register")) {
            await executeRegister(context, standup, text);
            return;
        }

        if (text.includes("!add")) {
            await executeAddUsers(context, standup);
            return;
        }

        if (text.startsWith("!remove")) {
            await executeRemoveUsers(context, standup);
            return;
        }

        if (text.startsWith("!history")) {
            // Check if it's a history view command or history settings command
            if (text === "!history" || text.includes("view")) {
                const result = await standup.getHistoricalStandups(activity.conversation.conversationType === 'personal' ? {
                    userId: context.userId,
                    tenantId: context.tenantId,
                } : {
                    conversationId: context.conversationId,
                    tenantId: context.tenantId,
                }
                );
                if (result.type === "error") {
                    await partialContext.send(result.message);
                    return;
                }
                await partialContext.send({
                    type: "message",
                    attachments: [
                        {
                            contentType: "application/vnd.microsoft.card.adaptive",
                            content: createHistoricalStandupsCard(result.data.histories),
                        },
                    ],
                });
                return;
            }

            // Handle history settings (only for group chats)
            if (isGroupChat) {
                const group = await standup.validateGroup(
                    context.conversationId,
                    context.tenantId
                );
                if (!group) {
                    await partialContext.send(
                        "No standup group registered. Use !register <onenote-link> to create one."
                    );
                    return;
                }

                const enable = text.includes("on");
                const disable = text.includes("off");

                if (!enable && !disable) {
                    const currentSetting = await group.getSaveHistory();
                    await partialContext.send(
                        `History saving is currently ${currentSetting ? "enabled" : "disabled"}. Use "!history on" or "!history off" to change.`
                    );
                    return;
                }

                await group.setSaveHistory(enable);
                await partialContext.send(
                    `History saving has been ${enable ? "enabled" : "disabled"}.`
                );
                return;
            } else {
                await partialContext.send("History settings are only available in group chats. Use natural language to view your personal history.");
                return;
            }
        }

        if (text.includes("group details") && isGroupChat) {
            await executeGroupDetails(context, standup);
            return;
        }

        if (text.includes("restart standup") && isGroupChat) {
            await executeStartStandup(context, standup, true);
            return;
        }

        if (text.includes("start standup") && isGroupChat) {
            await executeStartStandup(context, standup);
            return;
        }

        if (text.includes("close standup") && isGroupChat) {
            await executeCloseStandup(context, standup);
            return;
        }

        if (text.includes("custom-instruction") && isGroupChat) {
            const customInstruction = activity.text.slice("!custom-instruction".length).trim();
            const group = await standup.validateGroup(
                context.conversationId,
                context.tenantId
            );
            if (!group) {
                await partialContext.send(
                    "No standup group registered. Use !register <onenote-link> to create one."
                );
                return;
            }
            await group.setCustomInstructions(customInstruction);
        }

        // Parking lot command (only for group chats)
        if (text.startsWith("!parkinglot") && isGroupChat) {
            const parkingLotItem = activity.text.slice("!parkinglot".length).trim();

            // If no item provided, show current parking lot items
            if (!parkingLotItem) {
                const result = await standup.getParkingLotItems(
                    context.conversationId,
                    context.tenantId
                );
                if (result.type === "error") {
                    await partialContext.send(result.message);
                    return;
                }

                const card = createParkingLotCard(result.data.parkingLotItems);
                await partialContext.send({
                    type: "message",
                    attachments: [
                        {
                            contentType: "application/vnd.microsoft.card.adaptive",
                            content: card,
                        },
                    ],
                });
                return;
            }

            // If item provided, add it to parking lot
            const group = await standup.validateGroup(
                context.conversationId,
                context.tenantId
            );
            if (!group) {
                await partialContext.send(
                    "No standup group registered. Use !register <onenote-link> to create one."
                );
                return;
            }

            await group.addParkingLotItem(context.userId, parkingLotItem);
            await partialContext.send(
                "Your parking lot item has been saved for the next standup."
            );
            return;
        }

        // If we get here, it's an unrecognized command
        await partialContext.send(
            `Unrecognized command. Try using natural language or check available commands for ${isGroupChat ? "group chats" : "1:1 conversations"}.`
        );
        return;
    }

    console.log("Natural language command detected ", text);
    try {
        // Create mutable context to track if functions have already messaged the user
        const messageContext = {
            send: async (message: any) => {
                await partialContext.send(message);
            },
            didMessageUser: false
        };

        // Register appropriate functions based on conversation type
        if (isGroupChat) {
            registerGroupChatFunctions(nlpPrompt, context, standup, messageContext, activity, text);
        } else {
            registerPersonalChatFunctions(nlpPrompt, context, standup, messageContext);
        }

        const result = await nlpPrompt.send(text);
        console.log("Result of the natural language command", result);

        // Only send the result from NLP processing if functions haven't already messaged the user
        if (!messageContext.didMessageUser) {
            await partialContext.send(result.content ?? "I couldn't process that request. Please try rephrasing.");
        }
    } catch (error) {
        console.error("Error processing natural language command:", error);
        await partialContext.send(
            `I couldn't understand that command. ${isGroupChat
                ? "Try using ! prefix for direct commands or ask me about standup management."
                : "Try asking about your settings, work items, or standup history."}`
        );
    }
}
