import { cardAttachment } from "@microsoft/spark.api";
import { createStandupCard } from "../models/AdaptiveCards";
import { Standup } from "../models/Standup";
import { CommandContext } from "./types";

export async function executeStartStandup(
  context: CommandContext,
  standup: Standup,
  shouldRestart = false
) {
  const { send, conversationId, tenantId } = context;

  if (shouldRestart) {
    const closeResult = await standup.closeStandup(
      conversationId,
      tenantId,
      true
    );
    if (closeResult.type === "error") {
      await send(closeResult.message);
      return;
    }
  }

  // Send initial message to get activity ID
  const startMsg = await send("Starting standup...");

  // Start standup with activity ID
  const result = await standup.startStandup(
    conversationId,
    tenantId,
    startMsg.id
  );

  if (result.type === "error") {
    await send(result.message);
    return;
  }

  await send({
    type: "message",
    id: startMsg.id,
    attachments: [
      cardAttachment(
        "adaptive",
        createStandupCard([], result.data.previousParkingLot)
      ),
    ],
  });
}

export async function executeCloseStandup(
  context: CommandContext,
  standup: Standup
) {
  const { send, conversationId, tenantId } = context;

  const result = await standup.closeStandup(conversationId, tenantId);
  if (result.type === "error") {
    await send(result.message);
    return;
  }

  await send(result.message);
  if (result.data.summary) {
    await send({
      type: "message" as const,
      attachments: [cardAttachment("adaptive", result.data.summary)],
    });
  }
}
