import { StandupCoordinator } from "../models/StandupCoordinator";
import { CommandContext } from "./types";

export async function executeAddUsers(
    context: CommandContext,
    standup: StandupCoordinator
) {
    const { conversationId, mentions } = context;

    if (!mentions?.length) {
        return "Please @mention the users you want to add."
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
    return result.type === 'success' ? result.data.message : result.message
}

export async function executeRemoveUsers(
    context: CommandContext,
    standup: StandupCoordinator
) {
    const { conversationId, mentions } = context;

    if (!mentions?.length) {
        return "Please @mention the users you want to remove"
    }

    const userIds = mentions.map((mention) => mention.id);
    const result = await standup.removeUsers(
        conversationId,
        userIds,
        context.tenantId
    );
    return result.type === 'success' ? result.data.message : result.message
}

export async function executeGroupDetails(
    context: CommandContext,
    standup: StandupCoordinator
) {
    const { conversationId } = context;

    const result = await standup.getGroupDetails(
        conversationId,
        context.tenantId
    );
    if (result.type === "error") {
        return result.message
    }

    const { members, startedAt, storageType } = result.data;
    const memberList = members.map((m) => m.name).join(", ");
    const status = !!startedAt ? "Active standup in progress" : "No active standup";

    return `📊 **Standup Group Details**
Members (${members.length}): ${memberList}
Status: ${status}
Storage: ${storageType}`;
}
