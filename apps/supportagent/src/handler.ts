import { ChatPrompt } from "@microsoft/teams.ai";
import { OpenAIChatModel } from "@microsoft/teams.openai";
import { SupportCommands } from "./commands";
import { FileConfigStorage } from "./config/storage";
import { SupportResponse } from "./types";

const getConversationId = (context: { conversation: { id: string } }) => {
  if (context.conversation.id.includes("@thread.tacv2")) {
    const initialPart = context.conversation.id.split("@thread.tacv2")[0];
    return `${initialPart}@thread.tacv2`;
  }
  return context.conversation.id;
};

export class SupportHandler {
  private configStorage: FileConfigStorage;

  constructor() {
    this.configStorage = new FileConfigStorage();
  }

  async processMessage(
    text: string,
    context: { conversation: { id: string } }
  ): Promise<SupportResponse> {
    try {
      // If the converstaion id ends in messageid=<>, remove it. We only care about it till @thread.tacv2
      const conversationId = getConversationId(context);
      const config = await this.configStorage.get(conversationId);
      if (!config) {
        return {
          content:
            "Please configure the support agent first using the /config command.",
          data: [],
        };
      }

      const supportCommands = new SupportCommands(config);
      let functionCalls: { toolName: string; result: any }[] = [];
      const prompt = new ChatPrompt({
        instructions: `You are a support agent that helps search for and create GitHub issues for repository ${config.githubRepo}. 
When users ask questions, try to find relevant issues first. Only create new issues when explicitly requested 
or when no matching issues are found and the user's message clearly describes a problem.`,
        model: new OpenAIChatModel({
          apiKey: process.env.AZURE_OPENAI_API_KEY!,
          endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
          apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
          model: process.env.AZURE_OPENAI_MODEL_DEPLOYMENT_NAME!,
        }),
      });

      // Search for issues based on user's message
      prompt.function(
        "searchIssues",
        "Search for GitHub issues",
        // {
        //   type: "object",
        //   properties: {
        //     query: {
        //       type: "string",
        //       description: "Keywords to search for in GitHub issues",
        //     },
        //     priority: {
        //       type: "string",
        //       enum: ["low priority", "high priority"],
        //       description: "Priority of the issues that need to be searched",
        //     },
        //   },
        //   required: [],
        // },
        async (params: { query: string }) => {
          console.log("Searching for issues with query:", params.query);
          const result = await supportCommands.handleCommand({
            type: "searchIssues",
            query: params.query,
          });

          functionCalls.push({ toolName: "searchIssues", result });
          return result;
        }
      );

      // Create a new issue
      prompt.function(
        "createIssue",
        "Create a new GitHub issue",
        {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Title of the issue",
            },
            body: {
              type: "string",
              description: "Body/description of the issue",
            },
            labels: {
              type: "array",
              items: { type: "string" },
              description:
                "Labels to apply to the issue. If not provided, default labels will be used.",
            },
          },
          required: ["title", "body"],
        },
        async (params: { title: string; body: string; labels?: string[] }) => {
          const result = await supportCommands.handleCommand({
            type: "createIssue",
            title: params.title,
            body: params.body,
            labels: params.labels || config.labels,
          });
          functionCalls.push({ toolName: "createIssue", result });
          return result;
        }
      );

      const result = await prompt.send(text);
      const response: SupportResponse = {
        content:
          result.content ??
          "I couldn't process that request. Please try again.",
        data: functionCalls,
      };
      return response;
    } catch (error) {
      console.error("Error processing message:", error);
      return {
        content:
          "I encountered an error while processing your request. Please try again.",
        data: [],
      };
    }
  }
}
