import { StandupCoordinator } from "../models/StandupCoordinator";
import { CommandContext } from "./types";

export async function executeAddUsers(
  context: CommandContext,
  standup: StandupCoordinator
) {
  const { send, conversationId, mentions } = context;

  if (!mentions?.length) {
    await send("Please @mention the users you want to add.");
    return;
  }

  const users = mentions.map((mention) => ({
    id: mention.id,
    name: mention.name,
  }));

  const result = await standup.addUsers(
    conversationId,
    users,
    context.tenantId
  );
  await send(result.type === "success" ? result.data.message : result.message);
}

export async function executeRemoveUsers(
  context: CommandContext,
  standup: StandupCoordinator
) {
  const { send, conversationId, mentions } = context;

  if (!mentions?.length) {
    await send("Please @mention the users you want to remove.");
    return;
  }

  const userIds = mentions.map((mention) => mention.id);
  const result = await standup.removeUsers(
    conversationId,
    userIds,
    context.tenantId
  );
  await send(result.type === "success" ? result.data.message : result.message);
}

export async function executeGroupDetails(
  context: CommandContext,
  standup: StandupCoordinator
) {
  const { send, conversationId } = context;

  const result = await standup.getGroupDetails(
    conversationId,
    context.tenantId
  );
  if (result.type === "error") {
    await send(result.message);
    return;
  }

  const { members, isActive, storageType } = result.data;
  const memberList = members.map((m) => m.name).join(", ");
  const status = isActive ? "Active standup in progress" : "No active standup";

  await send(`📊 **Standup Group Details**
Members (${members.length}): ${memberList}
Status: ${status}
Storage: ${storageType}`);
}
