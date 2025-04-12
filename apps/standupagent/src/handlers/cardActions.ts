import { Standup } from "../models/Standup";
import { StandupResponse } from "../models/types";
import { OneNoteStorage } from "../services/OneNoteStorage";

export async function handleCardAction(
  activity: any,
  send: (message: any) => Promise<any>,
  api: any,
  standup: Standup
) {
  const conversationId = activity.conversation.id;
  const data = activity.value?.action?.data;

  if (!data) {
    return {
      statusCode: 200,
      type: "application/vnd.microsoft.activity.message",
      value: "No data provided.",
    };
  }

  switch (data.action) {
    case "register_standup": {
      if (!data.pageId) {
        await send("Please select a OneNote page.");
        return {
          statusCode: 200,
          type: "application/vnd.microsoft.activity.message",
          value: "Please select a OneNote page.",
        };
      }

      // Create storage for registration
      const storage = new OneNoteStorage(
        (api.user as any).http,
        data.pageId,
        {}
      );

      // Use source conversation ID for registration instead of the 1:1 chat ID
      const result = await standup.registerGroup(
        data.sourceConversationId,
        storage,
        {
          id: activity.from.id,
          name: activity.from.name,
        },
        activity.conversation.tenantId || "unknown"
      );

      const message =
        result.type === "success" ? result.data.message : result.message;
      await api.send(data.sourceConversationId, message);

      return {
        statusCode: 200,
        type: "application/vnd.microsoft.activity.message",
        value: message,
      };
    }

    case "submit_standup": {
      const standupResponse: StandupResponse = {
        userId: data.userId,
        completedWork: data.completedWork,
        plannedWork: data.plannedWork,
        timestamp: new Date(),
      };

      const result = await standup.submitResponse(
        conversationId,
        standupResponse,
        activity.conversation.tenantId || "unknown",
        send
      );

      const message =
        result.type === "success" ? result.data.message : result.message;
      await send(message);

      return {
        statusCode: 200,
        type: "application/vnd.microsoft.activity.message",
        value: message,
      };
    }

    case "close_standup": {
      const result = await standup.closeStandup(
        conversationId,
        activity.conversation.tenantId || "unknown"
      );
      const message =
        result.type === "success" ? result.data.message : result.message;

      if (result.type === "success" && result.data.summary) {
        await send(result.data.summary);
      }

      return {
        statusCode: 200,
        type: "application/vnd.microsoft.activity.message",
        value: message,
      };
    }

    default:
      return {
        statusCode: 400,
        type: "application/vnd.microsoft.activity.message",
        value: "Unknown action",
      };
  }
}
