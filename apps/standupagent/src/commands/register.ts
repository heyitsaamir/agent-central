import { createPageSelectionCard } from "../models/AdaptiveCards";
import { StandupCoordinator } from "../models/StandupCoordinator";
import { OneNoteStorage } from "../services/OneNoteStorage";
import { NoStorage } from "../services/Storage";
import { CommandContext } from "./types";

export async function executeRegister(
  context: CommandContext,
  standup: StandupCoordinator,
  text: string
) {
  const { send, conversationId, userId, userName, api, app } = context;

  // Check if group already exists
  if (await standup.validateGroup(conversationId, context.tenantId)) {
    await send("A standup group is already registered for this conversation.");
    return;
  }

  const includeHistory = text.includes("--history");

  if (!(text.includes("one") && text.includes("note"))) {
    // Create a new group with no storage if OneNote isn't specified
    const result = await standup.registerGroup(
      conversationId,
      new NoStorage(),
      {
        id: userId,
        name: userName,
      },
      context.tenantId,
      includeHistory
    );
    await send(
      result.type === "success" ? result.data.message : result.message
    );
    return;
  }

  // Create storage and get available pages
  const storage = new OneNoteStorage((api.users as any).http, "", {});
  const pagesResult = await storage.getPages();
  if (pagesResult.type === "error") {
    await send(`Failed to get OneNote pages: ${pagesResult.message}`);
    return;
  }

  if (pagesResult.data.length === 0) {
    await send("No OneNote pages found. Please create a page first.");
    return;
  }

  // Create 1:1 chat with user and send page selection card there
  const res = await api.conversations.create({
    tenantId: context.conversationId.split("/")[0],
    isGroup: false,
    bot: { id: context.app.botId },
    members: [{ id: userId, name: userName, role: "user" }],
  });

  // Send page selection card to user in 1:1 chat
  await app.send(res.id, {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: createPageSelectionCard(pagesResult.data, conversationId),
      },
    ],
  });

  // Notify in group chat
  await send(
    "📝 I've sent you a private message to select a OneNote page for registration."
  );
}
