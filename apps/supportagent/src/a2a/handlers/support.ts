import { AccumulateArtifacts, TaskUpdate } from "@microsoft/teams.a2a";
import { type schema, TaskContext, TaskYieldUpdate } from "a2aserver";
import { SupportHandler } from "../../handler";

type Part = schema.Part;
type TextPart = schema.TextPart;

export async function* supportAgentLogic(
  context: TaskContext
): AsyncGenerator<TaskYieldUpdate> {
  try {
    const textPart = context.userMessage.parts[0];
    if (!isTextPart(textPart)) {
      throw new Error("Expected text input");
    }

    yield {
      state: "working",
      message: {
        role: "agent",
        parts: [
          {
            type: "text",
            text: "Processing your request...",
          },
        ],
      },
    };

    const handler = new SupportHandler();
    const response = await handler.processMessage(textPart.text, {
      conversation: {
        id: (context.task.metadata?.conversationId as string) || "default",
      },
    });

    if (response.data.length > 0) {
      yield {
        name: response.data.map((d) => d.toolName).join("|"),
        parts: response.data.map((d) => ({
          type: "data",
          data: d.result,
        })),
      };
    } else if (response.content.includes("configure")) {
      yield {
        state: "input-required",
        message: {
          role: "agent",
          parts: [
            {
              type: "text",
              text: response.content,
            },
          ],
        },
      };
      return;
    }

    yield {
      state: "completed",
      message: {
        role: "agent",
        parts: [
          {
            type: "text",
            text: response.content,
          },
        ],
      },
    };
  } catch (error) {
    yield {
      state: "failed",
      message: {
        role: "agent",
        parts: [
          {
            type: "text",
            text: `Error processing request: ${error instanceof Error ? error.message : "Unknown error"
              }`,
          },
        ],
      },
    };
  }
}

export async function supportAgentLogic2(
  context: TaskContext,
  accumulateArtifacts: AccumulateArtifacts,
): Promise<TaskUpdate | string> {
  console.log("Received message:", context.userMessage);
  try {
    const textPart = context.userMessage.parts[0];
    if (!isTextPart(textPart)) {
      throw new Error("Expected text input");
    }

    const handler = new SupportHandler();
    const response = await handler.processMessage(textPart.text, {
      conversation: {
        id: (context.task.metadata?.conversationId as string) || "default",
      },
    });

    if (response.data.length > 0) {
      await accumulateArtifacts({
        name: response.data.map((d) => d.toolName).join("|"),
        parts: response.data.map((d) => ({
          type: "data",
          data: d.result,
        })),
      })
    }

    console.log("Response content:", response);
    return {
      state: response.type ?? 'completed',
      message: {
        role: "agent",
        parts: [
          {
            type: "text",
            text: response.content,
          },
        ],
      }
    };
  } catch (error) {
    return {
      state: "failed",
      message: {
        role: "agent",
        parts: [
          {
            type: "text",
            text: `Error processing request: ${error instanceof Error ? error.message : "Unknown error"
              }`,
          },
        ],
      },
    };
  }
}

const isTextPart = (part: Part): part is TextPart => {
  return part.type === "text" || "text" in part;
};

export const supportAgentCard: schema.AgentCard = {
  name: "Support Agent",
  description: "An agent that helps manage GitHub issues for support requests",
  url: "http://localhost:8000/a2a",
  provider: {
    organization: "Support Bot",
  },
  version: "0.0.1",
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  authentication: null,
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  skills: [
    {
      id: "search_issues",
      name: "Search Issues",
      description: "Search for existing GitHub issues",
      tags: ["github", "search", "issues"],
      examples: [
        "Find issues about authentication for conversationId 12345@thread.v2",
        "Search for high priority bugs for conversationId 12345@thread.v2",
        "Look for issues related to login problems for conversationId 12345@thread.v2",
      ],
    },
    {
      id: "create_issue",
      name: "Create Issue",
      description: "Create a new GitHub issue",
      tags: ["github", "create", "issues"],
      examples: [
        "Create issue for login bug",
        "Report new feature request",
        "Open a bug report for crash",
      ],
    },
  ],
};
