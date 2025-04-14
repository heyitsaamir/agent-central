import { ChatPrompt } from "@microsoft/spark.ai";
import { OpenAIChatModel } from "@microsoft/spark.openai";
import { SupportCommands } from "./commands";
import { FileConfigStorage } from "./config/storage";
import { Activity } from "./types";

export class SupportHandler {
  private configStorage: FileConfigStorage;

  constructor() {
    this.configStorage = new FileConfigStorage();
  }

  async processMessage(text: string, activity: Activity): Promise<string> {
    try {
      const config = await this.configStorage.get(activity.conversation.id);
      if (!config) {
        return "Please configure the support agent first using the /config command.";
      }

      const supportCommands = new SupportCommands(config);
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
        {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for issues",
            },
            priority: {
              type: "string",
              enum: ["low priority", "high priority"],
              description: "Priority of the issues that need to be searched",
            },
          },
          required: [],
        },
        async (params: { query: string }) => {
          return supportCommands.handleCommand({
            type: "searchIssues",
            query: params.query,
          });
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
          return supportCommands.handleCommand({
            type: "createIssue",
            title: params.title,
            body: params.body,
            labels: params.labels || config.labels,
          });
        }
      );

      const result = await prompt.send(text);
      return (
        result.content ?? "I couldn't process that request. Please try again."
      );
    } catch (error) {
      console.error("Error processing message:", error);
      return "I encountered an error while processing your request. Please try again.";
    }
  }
}
