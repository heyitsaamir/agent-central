import { TaskContext, TaskYieldUpdate } from "a2aserver";
import { Standup } from "../../models/Standup";
import { Result } from "../../models/types";

interface StandupCommand {
  type: "start" | "update" | "close";
  conversationId: string;
  tenantId: string;
  data?: {
    completed?: string;
    planned?: string;
    blockers?: string;
    userId?: string;
    userName?: string;
  };
}

function parseCommand(input: string): StandupCommand {
  try {
    const data = JSON.parse(input);
    if (!data.type || !data.conversationId || !data.tenantId) {
      throw new Error("Missing required fields");
    }
    return data as StandupCommand;
  } catch (e) {
    throw new Error("Invalid command format");
  }
}

async function* handleStartStandup(
  standup: Standup,
  conversationId: string,
  tenantId: string
): AsyncGenerator<TaskYieldUpdate> {
  yield {
    state: "working",
    message: { role: "agent", parts: [{ text: "Starting standup..." }] },
  };

  const result = await standup.startStandup(conversationId, tenantId);

  if (result.type === "error") {
    yield {
      state: "failed",
      message: { role: "agent", parts: [{ text: result.message }] },
    };
    return;
  }

  yield {
    state: "completed",
    message: {
      role: "agent",
      parts: [
        {
          text: "Standup started successfully",
          data: {
            previousParkingLot: result.data.previousParkingLot,
            participants: [],
          },
        },
      ],
    },
  };
}

async function* handleStandupUpdate(
  standup: Standup,
  command: StandupCommand
): AsyncGenerator<TaskYieldUpdate> {
  if (
    !command.data?.userId ||
    !command.data?.completed ||
    !command.data?.planned
  ) {
    yield {
      state: "failed",
      message: {
        role: "agent",
        parts: [{ text: "Missing required update fields" }],
      },
    };
    return;
  }

  const response = {
    userId: command.data.userId,
    completedWork: command.data.completed,
    plannedWork: command.data.planned,
    parkingLot: command.data.blockers,
    timestamp: new Date(),
  };

  const result = await standup.submitResponse(
    command.conversationId,
    response,
    command.tenantId
  );

  if (result.type === "error") {
    yield {
      state: "failed",
      message: { role: "agent", parts: [{ text: result.message }] },
    };
    return;
  }

  yield {
    state: "completed",
    message: {
      role: "agent",
      parts: [{ text: "Update recorded successfully" }],
    },
  };
}

async function* handleCloseStandup(
  standup: Standup,
  conversationId: string,
  tenantId: string
): AsyncGenerator<TaskYieldUpdate> {
  const result = await standup.closeStandup(conversationId, tenantId);

  if (result.type === "error") {
    yield {
      state: "failed",
      message: { role: "agent", parts: [{ text: result.message }] },
    };
    return;
  }

  // Extract participant data from the adaptive card
  const summaryData: Result<StandupSummaryData> = {
    type: "success",
    message: result.message,
    data: {
      message: result.message,
      summary:
        result.data.summary && Array.isArray(result.data.summary.body)
          ? {
              participants: result.data.summary.body
                .filter((item: any) => item.type === "Table")
                .flatMap((table: any) => {
                  const userName =
                    table.rows?.[0]?.cells?.[0]?.items?.[0]?.text;
                  const completedWork =
                    table.rows?.[0]?.cells?.[1]?.items?.[0]?.text;
                  const plannedWork =
                    table.rows?.[1]?.cells?.[1]?.items?.[0]?.text;
                  return userName && completedWork && plannedWork
                    ? [
                        {
                          userName,
                          completedWork,
                          plannedWork,
                        },
                      ]
                    : [];
                }),
            }
          : undefined,
    },
  };

  yield {
    state: "completed",
    message: {
      role: "agent",
      parts: [
        {
          text: result.message,
          data: {
            responses: await formatSummary(summaryData),
          },
        },
      ],
    },
  };
}

interface StandupSummaryData {
  message: string;
  summary?: {
    participants: Array<{
      userName: string;
      completedWork: string;
      plannedWork: string;
      parkingLot?: string;
    }>;
  };
}

async function formatSummary(result: Result<StandupSummaryData>): Promise<
  Array<{
    userName: string;
    completedWork: string;
    plannedWork: string;
    parkingLot?: string;
  }>
> {
  if (result.type === "error" || !result.data.summary?.participants) {
    return [];
  }

  return result.data.summary.participants;
}

export async function* standupAgentLogic(
  context: TaskContext
): AsyncGenerator<TaskYieldUpdate> {
  try {
    const textPart = context.userMessage.parts[0];
    if (textPart.type !== "text" || !textPart.text) {
      throw new Error("Expected text input");
    }
    const command = parseCommand(textPart.text);
    const standup = new Standup();

    switch (command.type) {
      case "start":
        yield* handleStartStandup(
          standup,
          command.conversationId,
          command.tenantId
        );
        break;
      case "update":
        yield* handleStandupUpdate(standup, command);
        break;
      case "close":
        yield* handleCloseStandup(
          standup,
          command.conversationId,
          command.tenantId
        );
        break;
      default:
        yield {
          state: "failed",
          message: { role: "agent", parts: [{ text: "Unknown command type" }] },
        };
    }
  } catch (error: unknown) {
    yield {
      state: "failed",
      message: {
        role: "agent",
        parts: [
          {
            text: `Error processing command: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
      },
    };
  }
}
