import {
  cardAttachment,
  ITaskFetchInvokeActivity,
  ITaskSubmitInvokeActivity,
} from "@microsoft/teams.api";
import { createTaskModule } from "../models/AdaptiveCards";
import { Standup } from "../models/Standup";
import { StandupResponse } from "../models/types";

export async function handleDialogOpen(
  activity: ITaskFetchInvokeActivity,
  standup?: Standup
) {
  const userId = activity.from.id;
  let existingResponse: StandupResponse | undefined;

  if (standup) {
    const group = await standup.validateGroup(
      activity.conversation.id,
      activity.conversation.tenantId || "unknown"
    );
    if (group) {
      const responses = await group.getActiveResponses();
      existingResponse = responses.find(
        (r: StandupResponse) => r.userId === userId
      );
    }
  }

  return {
    task: {
      type: "continue" as const,
      value: {
        title: "Standup Input",
        card: cardAttachment(
          "adaptive",
          createTaskModule(
            {
              id: userId,
              name: activity.from.name,
            },
            existingResponse
          )
        ),
      },
    },
  };
}

export async function handleDialogSubmit(
  activity: ITaskSubmitInvokeActivity,
  send: (message: any) => Promise<any>,
  standup: Standup
) {
  if (!standup) return;

  const conversationId = activity.conversation.id;
  const data = activity.value.data ?? {};

  const standupResponse: StandupResponse = {
    userId: activity.from.id,
    completedWork: (data.completedWork ?? "").replace("\n", " \n"),
    plannedWork: (data.plannedWork ?? "").replace("\n", " \n"),
    parkingLot: (data.parkingLot ?? "").replace("\n", " \n"),
    timestamp: new Date(),
  };

  // Get the group and check if standup is active
  const group = await standup.validateGroup(
    conversationId,
    activity.conversation.tenantId || "unknown"
  );
  if (!group) return;

  let result;
  const isActive = await group.isStandupActive();

  if (isActive) {
    // If standup is active, submit the full response
    result = await standup.submitResponse(
      conversationId,
      standupResponse,
      activity.conversation.tenantId || "unknown",
      send
    );
  } else if (standupResponse.parkingLot) {
    // If standup is not active but we have a parking lot item, just save that
    await group.addParkingLotItem(
      standupResponse.userId,
      standupResponse.parkingLot
    );
    result = {
      type: "success",
      data: {
        message: "Your parking lot item has been saved for the next standup.",
      },
      message: "Your parking lot item has been saved for the next standup.",
    };
  } else {
    result = {
      type: "error",
      message:
        "No standup is currently active. You can still add parking lot items for the next standup.",
    };
  }

  return {
    status: 200,
    body: {
      task: {
        type: "message",
        value:
          result.type === "success" && result.data?.message
            ? result.data.message
            : result.message,
      },
    },
  };
}
