import { ChatPrompt } from "@microsoft/teams.ai";
import { IMessageActivity } from "@microsoft/teams.api";
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

interface MessageContext {
    send: (message: any) => Promise<void>;
    didMessageUser: boolean;
}

export function registerGroupChatFunctions(
    nlpPrompt: ChatPrompt,
    context: CommandContext,
    standup: StandupCoordinator,
    messageContext: MessageContext,
    activity: IMessageActivity,
    text: string
): void {
    // Group management functions
    nlpPrompt.function("register", "Register a new standup group", async () => {
        messageContext.didMessageUser = true;
        await executeRegister(context, standup, text);
    });

    nlpPrompt.function("add", "Add users to the standup group", async () => {
        console.log("Adding users to the standup group");
        messageContext.didMessageUser = true;
        await executeAddUsers(context, standup);
    });

    nlpPrompt.function("remove", "Remove users from the standup group", async () => {
        console.log("Removing users from the standup group");
        messageContext.didMessageUser = true;
        await executeRemoveUsers(context, standup);
    });

    nlpPrompt.function("groupDetails", "Show standup group information", async () => {
        console.log("Showing standup group information");
        messageContext.didMessageUser = true;
        await executeGroupDetails(context, standup);
    });

    // Standup session management
    nlpPrompt.function("startStandup", "Start a new standup session", async () => {
        console.log("Starting a new standup session");
        messageContext.didMessageUser = true;
        await executeStartStandup(context, standup);
    });

    nlpPrompt.function("restartStandup", "Restart the current standup session", async () => {
        console.log("Restarting the current standup session");
        messageContext.didMessageUser = true;
        await executeStartStandup(context, standup, true);
    });

    nlpPrompt.function("closeStandup", "End the current standup session", async () => {
        console.log("Ending the current standup session");
        messageContext.didMessageUser = true;
        await executeCloseStandup(context, standup);
    });

    // History management
    nlpPrompt.function(
        "toggleHistory",
        "Enable or disable history saving for the standup group",
        {
            type: "object",
            properties: {
                enable: {
                    type: "boolean",
                    description: "Enable or disable history saving",
                },
            },
            required: ["enable"],
        },
        async (args: { enable: boolean }) => {
            const { enable } = args;
            console.log("Toggling history setting");
            const group = await standup.validateGroup(
                context.conversationId,
                context.tenantId
            );
            if (!group) {
                return "No standup group registered. Use !register to create one.";
            }

            await group.setSaveHistory(enable);
            return `History saving has been ${enable ? "enabled" : "disabled"}.`;
        }
    );

    nlpPrompt.function("setSpecialCustomInstruction", "Set a special custom instruction for agent to say when the standup closes",
        {
            type: "object",
            properties: {
                customInstruction: {
                    type: "string",
                    description: "The custom instruction that the agent should follow when the standup closes.",
                },
            },
            required: ["item"],
        },
        async (args: { customInstruction: string }) => {

            const { customInstruction } = args;
            console.log(`Updating custom instruction to ${customInstruction}`);
            const group = await standup.validateGroup(
                context.conversationId,
                context.tenantId
            );
            if (!group) {
                return "No standup group registered. Use !register to create one.";
            }

            await group.setCustomInstructions(customInstruction);
            return `Custom instruction '${customInstruction}' was saved successfully!`;
        }
    );

    nlpPrompt.function("checkHistory", "Check the current history saving setting", async () => {
        console.log("Checking history setting");
        const group = await standup.validateGroup(
            context.conversationId,
            context.tenantId
        );
        if (!group) {
            await messageContext.send(
                "No standup group registered. Use !register to create one."
            );
            messageContext.didMessageUser = true;
            return;
        }

        const currentSetting = await group.getSaveHistory();
        return `History saving is currently ${currentSetting ? "enabled" : "disabled"}. You can change this with "enable history" or "disable history".`
    });

    nlpPrompt.function("viewHistory", "View historical standup information", async () => {
        try {
            console.log("Viewing standup history");
            const result = await standup.getHistoricalStandups(activity.conversation.isGroup ? {
                conversationId: context.conversationId,
                tenantId: context.tenantId,
            } : {
                userId: context.userId,
                tenantId: context.tenantId,
            }
            );

            if (result.type === "error") {
                await messageContext.send(result.message);
                messageContext.didMessageUser = true;
                return;
            }

            await messageContext.send({
                type: "message",
                attachments: [
                    {
                        contentType: "application/vnd.microsoft.card.adaptive",
                        content: createHistoricalStandupsCard(result.data.histories),
                    },
                ],
            });
            messageContext.didMessageUser = true;
        } catch (error) {
            console.error("Error viewing standup history:", error);
            throw error;
        }
    });

    // Parking lot functions
    nlpPrompt.function("clearParkingLot", "Clear all items from the parking lot", async () => {
        console.log("Clearing parking lot items");
        const group = await standup.validateGroup(
            context.conversationId,
            context.tenantId
        );
        if (!group) {
            return "No standup group registered. Use !register to create one.";
        }
        const clearedItems = await group.clearParkingLot(context.userId);
        return clearedItems.message;
    });

    nlpPrompt.function("viewParkingLot", "View current parking lot items", async () => {
        console.log("Viewing parking lot items");
        const result = await standup.getParkingLotItems(
            context.conversationId,
            context.tenantId
        );

        if (result.type === "error") {
            await messageContext.send(result.message);
            messageContext.didMessageUser = true;
            return;
        }

        const card = createParkingLotCard(result.data.parkingLotItems);
        await messageContext.send({
            type: "message",
            attachments: [
                {
                    contentType: "application/vnd.microsoft.card.adaptive",
                    content: card,
                },
            ],
        });
        messageContext.didMessageUser = true;
    });

    nlpPrompt.function(
        "addParkingLot",
        "Add an item to discuss in the next standup's parking lot",
        {
            type: "object",
            properties: {
                item: {
                    type: "string",
                    description: "The item to add to the parking lot",
                },
            },
            required: ["item"],
        },
        async (args: { item: string }) => {
            console.log("Adding parking lot item");
            const group = await standup.validateGroup(
                context.conversationId,
                context.tenantId
            );
            if (!group) {
                await messageContext.send(
                    "No standup group registered. Use !register to create one."
                );
                messageContext.didMessageUser = true;
                return;
            }

            await group.addParkingLotItem(context.userId, args.item);
            await messageContext.send(
                "Your parking lot item has been saved for the next standup."
            );
            messageContext.didMessageUser = true;
        }
    );

    nlpPrompt.function("purpose", "Explain the purpose of the bot", async () => {
        console.log("Explaining the purpose of the bot");
        return `I can help you conduct standups by managing your standup group, adding or removing users, starting or closing standup sessions, managing history settings, viewing historical standups, and saving parking lot items for future standups.`;
    });
}

export function registerPersonalChatFunctions(
    nlpPrompt: ChatPrompt,
    context: CommandContext,
    standup: StandupCoordinator,
    messageContext: MessageContext): void {
    // User settings functions
    nlpPrompt.function("viewSettings", "Show your standup settings", async () => {
        console.log("Viewing user settings");
        const result = await standup.getUserSettings(context.userId, context.tenantId);

        if (result.type === "error") {
            await messageContext.send(result.message);
            messageContext.didMessageUser = true;
            return;
        }

        const settings = result.data.settings;
        if (!settings) {
            await messageContext.send("You don't have any standup settings yet. Join a standup group to get started!");
            messageContext.didMessageUser = true;
            return;
        }

        let message = `**Your Standup Settings:**\n\n`;
        message += `**Standup Groups:** ${settings.standupGroups.length > 0 ? settings.standupGroups.join(", ") : "None"}\n`;
        message += `**Default Standup:** ${settings.defaultStandupGroup || "None set"}\n`;
        message += `**Last Updated:** ${settings.lastUpdated.toLocaleString()}`;

        await messageContext.send(message);
        messageContext.didMessageUser = true;
    });

    nlpPrompt.function(
        "setDefaultStandup",
        "Set your default standup group",
        {
            type: "object",
            properties: {
                standupIdOrName: {
                    type: "string",
                    description: "The ID or Name of the standup group to set as default",
                },
            },
            required: ["standupId"],
        },
        async (args: { standupIdOrName: string }) => {
            console.log("Setting default standup");
            const result = await standup.setDefaultStandup(context.userId, context.tenantId, args.standupIdOrName);

            if (result.type === "error") {
                await messageContext.send(result.message);
                messageContext.didMessageUser = true;
                return;
            }

            await messageContext.send(result.message);
            messageContext.didMessageUser = true;
        }
    );

    nlpPrompt.function("listStandups", "Show standups you participate in", async () => {
        console.log("Listing user standups");
        const result = await standup.getStandupsForUser(context.userId, context.tenantId);

        if (result.type === "error") {
            await messageContext.send(result.message);
            messageContext.didMessageUser = true;
            return;
        }

        const standups = result.data.standups;
        if (standups.length === 0) {
            await messageContext.send("You're not participating in any standups yet.");
            messageContext.didMessageUser = true;
            return;
        }

        let message = "**Your Standups:**\n\n";
        standups.forEach((standup: { conversationName: string | null; conversationId: string; isDefault: boolean }) => {
            message += `- ${standup.conversationName ? `${standup.conversationName} ` : ''}${standup.conversationId}${standup.isDefault ? " (default)" : ""}\n\n`;
        });

        await messageContext.send(message);
        messageContext.didMessageUser = true;
        return message
    });



    // Work item tracking functions (group-based)
    nlpPrompt.function(
        "addWork",
        "Add a work item to your default standup group",
        {
            type: "object",
            properties: {
                item: {
                    type: "string",
                    description: "The work item to add",
                },
            },
            required: ["item"],
        },
        async (args: { item: string }) => {
            console.log("Adding work item to default group");
            const result = await standup.addWorkItemToDefaultGroup(context.userId, context.tenantId, args.item);

            if (result.type === "error") {
                await messageContext.send(result.message);
                messageContext.didMessageUser = true;
                return;
            }

            await messageContext.send(result.message);
            messageContext.didMessageUser = true;
        }
    );

    nlpPrompt.function("viewTodaysWork", "Show your work items from your default standup group", async () => {
        console.log("Viewing work items from default group");
        const result = await standup.getWorkItemsFromDefaultGroup(context.userId, context.tenantId);

        if (result.type === "error") {
            await messageContext.send(result.message);
            messageContext.didMessageUser = true;
            return;
        }

        const { workItems, groupId, groupName } = result.data;
        if (workItems.length === 0) {
            await messageContext.send(`You haven't added any work items to your default standup group (${groupId}) yet.`);
            messageContext.didMessageUser = true;
            return;
        }

        let message = `**Your Work Items for ${groupName ?? groupId}:**\n\n`;
        workItems.forEach((item: string, index: number) => {
            message += `${index + 1}. ${item}\n`;
        });

        await messageContext.send(message);
        messageContext.didMessageUser = true;
    });

    nlpPrompt.function("clearTodaysWork", "Clear your work items from your default standup group", async () => {
        console.log("Clearing work items from default group");
        const result = await standup.clearWorkItemsFromDefaultGroup(context.userId, context.tenantId);

        if (result.type === "error") {
            await messageContext.send(result.message);
            messageContext.didMessageUser = true;
            return;
        }

        await messageContext.send(result.message);
        messageContext.didMessageUser = true;
    });

    // Personal history
    nlpPrompt.function("viewPersonalHistory", "View your personal standup history", async () => {
        console.log("Viewing personal standup history");
        const result = await standup.getHistoricalStandups({
            userId: context.userId,
            tenantId: context.tenantId,
        }
        );

        if (result.type === "error") {
            await messageContext.send(result.message);
            messageContext.didMessageUser = true;
            return;
        }

        await messageContext.send({
            type: "message",
            attachments: [
                {
                    contentType: "application/vnd.microsoft.card.adaptive",
                    content: createHistoricalStandupsCard(result.data.histories),
                },
            ],
        });
        messageContext.didMessageUser = true;
    });

    nlpPrompt.function("purpose", "Explain what I can help you with", async () => {
        console.log("Explaining personal bot capabilities");
        return `I can help you manage your personal standup experience! You can:
• View and manage your standup settings
• Set your default standup group
• Add work items to your default standup group
• View and clear your work items from your default group
• View your personal standup history across all teams
• Manage which standups you participate in`;
    });
}
