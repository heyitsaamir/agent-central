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

      let status: 'completed' | 'input-required' = 'completed';
      let functionCalls: { toolName: string; result: any }[] = [];
      const prompt = new ChatPrompt({
        instructions: `You are a support agent that helps search for and create GitHub issues. 
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
        {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Keywords to search for in GitHub issues",
            },
            conversationId: {
              type: "string",
              description: "The ID of the conversation",
            }
          },
          required: ["conversationId"],
        },
        async (params: { query?: string; conversationId: string }) => {
          const config = await this.configStorage.get(params.conversationId);
          if (!config) {
            status = 'input-required';
            return {
              content:
                "Please configure the support agent first using the /config command.",
              data: [],
            };
          }
          console.log("Searching for issues with query:", params.query);
          const supportCommands = new SupportCommands(config);
          const result = await supportCommands.handleCommand({
            type: "searchIssues",
            query: params.query,
          });

          functionCalls.push({ toolName: "searchIssues", result });
          return result;
        }
      ).function('needMoreInfo', 'Ask the user for more information', () => {
        functionCalls.push({
          toolName: "needMoreInfo",
          result: "I need more information to assist you. Please provide details about the issue you're facing.",
        });
        status = 'input-required';
        return {
          content:
            "I need more information to assist you. Please provide details about the issue you're facing.",
          data: [],
        };
      })

      const result = await prompt.send(text);
      const response: SupportResponse = {
        content:
          result.content ??
          "I couldn't process that request. Please try again.",
        data: functionCalls,
        type: status,
      };
      return response;
    } catch (error) {
      console.error("Error processing message:", error);
      return {
        content:
          "I encountered an error while processing your request. Please try again.",
        data: [],
        type: "failed",
      };
    }
  }
}
