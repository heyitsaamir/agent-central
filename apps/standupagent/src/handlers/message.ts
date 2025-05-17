import { ChatPrompt } from "@microsoft/teams.ai";
import { IMessageActivity, MentionEntity } from "@microsoft/teams.api";
import { OpenAIChatModel } from "@microsoft/teams.openai";
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
import { Standup } from "../models/Standup";

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
  standup: Standup
) {
  if (activity.text == null) {
    return;
  }

  // if (!isSignedIn) {
  //   await send("Please sign in to use this bot.");
  //   await signin();
  //   return;
  // }

  // Initialize ChatPrompt once for natural language commands
  const nlpPrompt = new ChatPrompt({
    instructions:
      "You are a Standup Agent assistant that understands natural language commands. Use the tools available to you to figure out what the user wants to do.",
    model: new OpenAIChatModel({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION,
      model: process.env.AZURE_OPENAI_MODEL_DEPLOYMENT_NAME!,
    }),
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
        const result = await standup.getHistoricalStandups(
          context.conversationId,
          context.userId,
          context.tenantId,
          activity.conversation.conversationType !== "personal"
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

      // Handle history settings
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
          `History saving is currently ${currentSetting ? "enabled" : "disabled"
          }. Use "!history on" or "!history off" to change.`
        );
        return;
      }

      await group.setSaveHistory(enable);
      await partialContext.send(
        `History saving has been ${enable ? "enabled" : "disabled"}.`
      );
      return;
    }

    if (text.includes("group details")) {
      await executeGroupDetails(context, standup);
      return;
    }

    if (text.includes("restart standup")) {
      await executeStartStandup(context, standup, true);
      return;
    }

    if (text.includes("start standup")) {
      await executeStartStandup(context, standup);
      return;
    }

    if (text.includes("close standup")) {
      await executeCloseStandup(context, standup);
      return;
    }

    // New command for parking lot items
    if (text.startsWith("!parkinglot")) {
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
    return;
  }

  console.log("Natural language command detected ", text);
  let didMessageUser: boolean = false;
  try {
    // Register functions for natural language command interpretation
    nlpPrompt.function("register", "Register a new standup group", async () => {
      didMessageUser = true;
      await executeRegister(context, standup, text);
    });

    nlpPrompt.function("add", "Add users to the standup group", async () => {
      didMessageUser = true;
      console.log("Adding users to the standup group");
      await executeAddUsers(context, standup);
    });

    nlpPrompt.function(
      "remove",
      "Remove users from the standup group",
      async () => {
        didMessageUser = true;
        console.log("Removing users from the standup group");
        await executeRemoveUsers(context, standup);
      }
    );

    nlpPrompt.function(
      "groupDetails",
      "Show standup group information",
      async () => {
        didMessageUser = true;
        console.log("Showing standup group information");
        await executeGroupDetails(context, standup);
      }
    );

    nlpPrompt.function(
      "startStandup",
      "Start a new standup session",
      async () => {
        didMessageUser = true;
        console.log("Starting a new standup session");
        await executeStartStandup(context, standup);
      }
    );

    nlpPrompt.function(
      "restartStandup",
      "Restart the current standup session",
      async () => {
        didMessageUser = true;
        console.log("Restarting the current standup session");
        await executeStartStandup(context, standup, true);
      }
    );

    nlpPrompt.function(
      "closeStandup",
      "End the current standup session",
      async () => {
        didMessageUser = true;
        console.log("Ending the current standup session");
        await executeCloseStandup(context, standup);
      }
    );

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
        didMessageUser = false;
        console.log("Toggling history setting");
        const group = await standup.validateGroup(
          context.conversationId,
          context.tenantId
        );
        if (!group) {
          return "No standup group registered. Use !register <onenote-link> to create one.";
        }

        await group.setSaveHistory(enable);
        return `History saving has been ${enable ? "enabled" : "disabled"}.`;
      }
    );

    nlpPrompt.function(
      "checkHistory",
      "Check the current history saving setting",
      async () => {
        didMessageUser = true;
        console.log("Checking history setting");
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

        const currentSetting = await group.getSaveHistory();
        await partialContext.send(
          `History saving is currently ${currentSetting ? "enabled" : "disabled"
          }. You can change this with "enable history" or "disable history".`
        );
      }
    );

    nlpPrompt.function(
      "clearParkingLot",
      "Clear all items from the parking lot",
      async () => {
        console.log("Clearing parking lot items");
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
        const clearedItems = await group.clearParkingLot(context.userId);
        return clearedItems.message;
      }
    );

    nlpPrompt.function(
      "viewParkingLot",
      "View current parking lot items",
      async () => {
        didMessageUser = true;
        console.log("Viewing parking lot items");
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
      }
    );

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
        didMessageUser = true;
        console.log("Adding parking lot item");
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

        await group.addParkingLotItem(context.userId, args.item);
        await partialContext.send(
          "Your parking lot item has been saved for the next standup."
        );
      }
    );

    nlpPrompt.function(
      "viewHistory",
      "View historical standup information",
      async () => {
        didMessageUser = true;
        try {
          console.log("Viewing standup history");
          const result = await standup.getHistoricalStandups(
            context.conversationId,
            context.userId,
            context.tenantId,
            activity.conversation.isGroup ?? false
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
        } catch (error) {
          console.error("Error viewing standup history:", error);
          throw error;
        }
      }
    );

    nlpPrompt.function(
      "purpose",
      "Explain the purpose of the bot",
      async () => {
        console.log("Explaining the purpose of the bot");
        return `I can help you conduct standups by managing your standup group, adding or removing users, starting or closing standup sessions, managing history settings, viewing historical standups, and saving parking lot items for future standups (use !parkinglot or just tell me what you want to discuss).`;
      }
    );

    const result = await nlpPrompt.send(text);
    console.log("Result of the natural language command", result);
    if (!didMessageUser) {
      console.log("Sending the result of the natural language command");
      await partialContext.send(result.content ?? "");
    } else {
      console.log("Did not send the result of the natural language command");
    }
  } catch (error) {
    console.error("Error processing natural language command:", error);
    await partialContext.send(
      "I couldn't understand that command. Try using ! prefix for direct commands."
    );
  }
}
