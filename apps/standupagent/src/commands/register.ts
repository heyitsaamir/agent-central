import { StandupCoordinator } from "../models/StandupCoordinator";
import { NoStorage } from "../services/Storage";
import { CommandContext } from "./types";

export async function executeRegister(
    context: CommandContext,
    standup: StandupCoordinator,
    text: string
) {
    const { send, conversationId, conversationName, userId, userName } = context;

    // Check if group already exists
    if (await standup.validateGroup(conversationId, context.tenantId)) {
        await send("A standup group is already registered for this conversation.");
        return;
    }

    const includeHistory = text.includes("--history");

    // Create a new group with no storage
    const result = await standup.registerGroup(
        conversationId,
        conversationName,
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
}
