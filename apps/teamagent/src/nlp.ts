import { ChatPrompt } from "@microsoft/teams.ai";
import { OpenAIChatModel } from "@microsoft/teams.openai";
import { TeamCommands } from "./commands";
import { FileListStorage, MemoryConfig } from "./memory";
import { Activity, TeamCommand, TeamContext } from "./types";

const getConversationId = (context: { conversation: { id: string } }) => {
  console.log("Conversation ID:", context.conversation.id);
  if (context.conversation.id.includes("@thread.tacv2")) {
    const initialPart = context.conversation.id.split("@thread.tacv2")[0];
    console.log("Initial part:", initialPart);
    return `${initialPart}@thread.tacv2`;
  }
  console.log("No thread ID found, returning original ID");
  return context.conversation.id;
};

export class NLPHandler {
  private teamCommands: TeamCommands;
  private memories = new Map<string, FileListStorage>();
  private memoryConfig: MemoryConfig = {
    type: "time",
    value: 10, // Last 10 minutes by default
  };

  constructor(config?: MemoryConfig) {
    this.teamCommands = new TeamCommands();
    if (config) {
      this.memoryConfig = config;
    }
  }

  private getMemory(conversationId: string): FileListStorage {
    if (!this.memories.has(conversationId)) {
      this.memories.set(
        conversationId,
        new FileListStorage(conversationId, this.memoryConfig)
      );
    }
    return this.memories.get(conversationId)!;
  }

  private async initializeContext(activity: Activity): Promise<TeamContext> {
    const allTeams = await this.teamCommands.storage.getAll();
    console.log("All teams:", allTeams);
    const conversationId = getConversationId(activity);

    const ctx = {
      currentTeam: allTeams.find((t) => t.channelIds.includes(conversationId)),
      memberTeams: allTeams.filter((t) =>
        t.members.some((m) => m.id === activity.from.id)
      ),
      channelId: conversationId,
      userId: activity.from.id,
      tenantId: activity.conversation.tenantId ?? "unknown",
    };

    console.log("Context initialized:", ctx);
    return ctx;
  }

  private async initializePrompt(context: TeamContext, activity: Activity) {
    const conversationId = getConversationId(activity);
    const memory = this.getMemory(conversationId);
    const commandContext = { userId: context.userId };

    const prompt = new ChatPrompt({
      instructions:
        "You are a team management assistant that helps organize and manage team information. " +
        (context.currentTeam
          ? `You are currently in the context of team "${context.currentTeam.name}". Here are the team's details: ${JSON.stringify(context.currentTeam.details)}. `
          : "You are not currently in any team's context. ") +
        (context.memberTeams.length > 0
          ? `The user (${activity.from.name}) is a member of these teams: ${context.memberTeams
              .map((t) => t.name)
              .join(", ")}. `
          : `The user (${activity.from.name}) is not a member of any teams. `),
      model: new OpenAIChatModel({
        apiKey: process.env.AZURE_OPENAI_API_KEY!,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
        model: process.env.AZURE_OPENAI_MODEL_DEPLOYMENT_NAME!,
      }),
      messages: memory,
    });

    // Always available commands
    prompt.function(
      "createTeam",
      "Create a new team with a name and description",
      {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the team" },
          description: {
            type: "string",
            description: "Description of the team",
          },
        },
        required: ["name", "description"],
      },
      async (params: { name: string; description: string }) => {
        const cmd: TeamCommand = {
          type: "create",
          name: params.name,
          description: params.description,
          channelId: conversationId,
          tenantId: activity.conversation.tenantId ?? "unknown",
        };
        return this.teamCommands.handleCommand(cmd, commandContext);
      }
    );

    // Team-specific commands when in a channel
    if (context.currentTeam) {
      prompt.function(
        "addMember",
        "Add members to the current team (handles @mentions)",
        {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the member to add" },
          },
          required: ["name"],
        },
        async (params: { name: string }) => {
          console.log("Adding member:", params.name);
          const mentions =
            activity.entities?.filter((e) => e.type === "mention") || [];

          if (mentions.length > 0) {
            const results = await Promise.all(
              mentions.map(async (mention) => {
                if (mention.mentioned) {
                  const cmd: TeamCommand = {
                    type: "addMember",
                    teamId: context.currentTeam!.id,
                    name: mention.mentioned.name,
                  };
                  return this.teamCommands.handleCommand(cmd, commandContext);
                }
                return null;
              })
            );
            return results.filter(Boolean).join("\n");
          } else {
            const cmd: TeamCommand = {
              type: "addMember",
              teamId: context.currentTeam!.id,
              name: params.name,
            };
            return this.teamCommands.handleCommand(cmd, commandContext);
          }
        }
      );

      prompt.function(
        "joinTeam",
        "Join the current team",
        {
          type: "object",
          properties: {},
        },
        async () => {
          const cmd: TeamCommand = {
            type: "joinTeam",
            teamId: context.currentTeam!.id,
            userId: activity.from.id,
            name: activity.from.name,
          };
          return this.teamCommands.handleCommand(cmd, commandContext);
        }
      );

      prompt.function(
        "listMembers",
        "List all members in the current team",
        {
          type: "object",
          properties: {},
        },
        async () => {
          const cmd: TeamCommand = {
            type: "listMembers",
            teamId: context.currentTeam!.id,
          };
          return this.teamCommands.handleCommand(cmd, commandContext);
        }
      );

      prompt.function(
        "rememberDetail",
        "Remember a detail for the current team.",
        {
          type: "object",
          properties: {
            key: { type: "string", description: "Key for the detail" },
            value: { type: "string", description: "Value for the detail" },
          },
          required: ["key", "value"],
        },
        async (params: { key: string; value: string }) => {
          const cmd: TeamCommand = {
            type: "setDetail",
            teamId: context.currentTeam!.id,
            key: params.key,
            value: params.value,
          };
          return this.teamCommands.handleCommand(cmd, commandContext);
        }
      );

      prompt.function(
        "getDetail",
        "Get a custom detail from the current team",
        async () => {
          const cmd: TeamCommand = {
            type: "getDetail",
            teamId: context.currentTeam!.id,
          };
          return this.teamCommands.handleCommand(cmd, commandContext);
        }
      );
    }

    prompt.function(
      "listMyTeams",
      "List all teams you are a member of",
      {
        type: "object",
        properties: {},
      },
      async () => {
        const cmd: TeamCommand = {
          type: "listMyTeams",
          userId: context.userId,
        };
        return this.teamCommands.handleCommand(cmd, commandContext);
      }
    );

    prompt.function(
      "getParkingLotItems",
      "Get items from the parking lot for a team's standup",
      {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The question to ask the standup agent",
          },
        },
        required: ["question"],
      },
      async (params: { question: string }) => {
        const cmd: TeamCommand = {
          type: "askStandupAgent",
          teamDetails: context.currentTeam!,
          question: params.question,
          userId: context.userId,
        };
        return this.teamCommands.handleCommand(cmd, commandContext);
      }
    );

    prompt.function(
      "askSupportAgent",
      "Ask the support agent about GitHub issues",
      {
        type: "object",
        properties: {
          question: {
            type: "string",
            description:
              "The question to ask the support agent about GitHub issues",
          },
          conversationId: {
            type: "string",
            description:
              "The conversation ID where the support agent is active for this team",
          },
        },
        required: ["question", "conversationId"],
      },
      async (params: { question: string; conversationId: string }) => {
        const cmd: TeamCommand = {
          type: "askSupportAgent",
          teamDetails: context.currentTeam!,
          question: params.question,
          userId: context.userId,
          conversationId: params.conversationId,
        };
        return this.teamCommands.handleCommand(cmd, context);
      }
    );

    prompt.function(
      "validateRelease",
      "Validate if we are ready to release",
      async () => {
        return `To check if we are ready to release, we must as the support agent if there are any major ongoing issues. After we get the response, make sure you attribute that you got this information from the support agent.`;
      }
    );

    return prompt;
  }

  async processMessage(text: string, activity: Activity): Promise<string> {
    try {
      const context = await this.initializeContext(activity);
      const prompt = await this.initializePrompt(context, activity);

      const result = await prompt.send(text);

      return result.content ?? "";
    } catch (error) {
      console.error("Error processing message:", error);
      return "I had trouble understanding that request. Could you please rephrase it?";
    }
  }

  setMemoryConfig(config: MemoryConfig): void {
    this.memoryConfig = config;
  }
}
