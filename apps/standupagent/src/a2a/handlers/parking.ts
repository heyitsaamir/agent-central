import { ChatPrompt } from "@microsoft/spark.ai";
import { OpenAIChatModel } from "@microsoft/spark.openai";
import { type schema, TaskContext, TaskYieldUpdate } from "a2aserver";
import { ensureStandupInitialized } from "../../utils/initializeStandup";

type Part = schema.Part;
type TextPart = schema.TextPart;

const isTextPart = (part: Part): part is TextPart => {
  return part.type === "text" || "text" in part;
};

export async function* parkingLotAgentLogic(
  context: TaskContext
): AsyncGenerator<TaskYieldUpdate> {
  try {
    const textPart = context.userMessage.parts[0];
    if (!isTextPart(textPart)) {
      throw new Error("Expected text input");
    }

    const text = textPart.text;
    const standup = await ensureStandupInitialized();
    console.log("Handling parking lot command:", text);
    if (standup.type === "error") {
      console.error("Standup not initialized:", standup.message);
      yield {
        state: "failed",
        message: {
          role: "agent",
          parts: [
            {
              text: "Standup not initialized.",
            },
          ],
        },
      };
      return;
    }

    // Validate
    let tenantId: string;
    if (
      context.task.metadata?.tenantId != null &&
      typeof context.task.metadata.tenantId === "string"
    ) {
      tenantId = context.task.metadata.tenantId;
    } else {
      yield {
        state: "failed",
        message: {
          role: "agent",
          parts: [
            {
              text: "Tenant ID is missing in the metadata.",
            },
          ],
        },
      };
      return;
    }

    let userId: string;
    if (
      context.task.metadata?.userId != null &&
      typeof context.task.metadata.userId === "string"
    ) {
      userId = context.task.metadata.userId;
    } else {
      console.error("User ID is missing in the metadata.");
      yield {
        state: "failed",
        message: {
          role: "agent",
          parts: [
            {
              text: "User ID is missing in the metadata.",
            },
          ],
        },
      };
      return;
    }

    yield {
      state: "working",
      message: {
        role: "agent",
        parts: [{ text: "Processing your request..." }],
      },
    };

    // Initialize ChatPrompt for natural language commands
    const nlpPrompt = new ChatPrompt({
      instructions:
        "You are a parking lot manager for standups. Your role is to add items to discuss later or show the current list of items.",
      model: new OpenAIChatModel({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION,
        model: process.env.AZURE_OPENAI_MODEL_DEPLOYMENT_NAME!,
      }),
    });

    let responseData: any = null;
    let toolCall: string = "";

    // Register parking lot functions
    nlpPrompt.function(
      "addParkingLot",
      "Add an item to the parking lot for later discussion",
      {
        type: "object",
        properties: {
          item: {
            type: "string",
            description: "The item to add to the parking lot",
          },
          conversationId: {
            type: "string",
            description: "The conversation ID",
          },
        },
        required: ["item", "conversationId"],
      },
      async (args: {
        item: string;
        conversationId: string;
        userId: string;
      }) => {
        const group = await standup.data.validateGroup(
          args.conversationId,
          tenantId
        );
        if (!group) {
          return "No standup group registered.";
        }

        await group.addParkingLotItem(userId, args.item);
        toolCall = "addParkingLot";
        responseData = {
          item: args.item,
          result: "added to parking lot for discussion",
        };
        return "Item has been added to the parking lot.";
      }
    );

    nlpPrompt.function(
      "getParkingLot",
      "View the current parking lot items",
      {
        type: "object",
        properties: {
          conversationId: {
            type: "string",
            description: "The conversation ID",
          },
        },
        required: ["conversationId"],
      },
      async (args: { conversationId: string }) => {
        const result = await standup.data.getParkingLotItems(
          args.conversationId,
          tenantId
        );

        if (result.type === "error") {
          return result.message;
        }

        if (result.data.parkingLotItems.length === 0) {
          return "No parking lot items have been added yet.";
        }
        toolCall = "getParkingLot";
        responseData = { items: result.data.parkingLotItems };
        return responseData;
      }
    );

    // Process the command
    const result = await nlpPrompt.send(text);

    console.log("NLP result:", result);
    console.log("Tool call:", toolCall);
    yield {
      name: toolCall,
      parts: [
        {
          type: "data",
          data: responseData,
        },
      ],
    };

    yield {
      state: "completed",
      message: {
        role: "agent",
        parts: [
          {
            text: `Command processed successfully`,
          },
        ],
      },
    };
  } catch (error: unknown) {
    yield {
      state: "failed",
      message: {
        role: "agent",
        parts: [
          {
            text: `Error processing request: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
      },
    };
  }
}
