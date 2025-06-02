import { Result } from "../models/types";
import { ensureStandupInitialized } from "../utils/initializeStandup";

// const DEMO_TENANT_ID = 'e4ff76df-c755-4ada-a9f6-08182e797f2f';
// const DEMO_CONVERSATION_ID = '19:3fcdccf24f824f119a4a41d294f90f61@thread.v2';

interface DemoScenarioSuccess {
  conversationId: string;
}

export async function parkingLotAddition(
  query: string,
  tenantId: string,
  conversationId: string,
): Promise<Result<DemoScenarioSuccess>> {
  try {
    const standup = await ensureStandupInitialized();
    console.log("Handling parking lot command:", query);
    if (standup.type === "error") {
      console.error("Standup not initialized:", standup.message);
      return {
        type: 'error',
        message: "Standup not initialized.",
      }
    }

    const group = await standup.data.validateGroup(
      conversationId,
      tenantId
    );

    if (!group) {
      return {
        type: 'error',
        message: "No standup group registered.",
      }
    }

    await group.addParkingLotItem(null, query);

    return {
      type: 'success',
      data: { conversationId: conversationId, },
      message: 'Parking lot item added successfully.',
    }
  } catch (error) {
    console.error("Error handling parking lot command:", error);
    return {
      type: 'error',
      message: "An error occurred while processing the parking lot command.",
    }
  }
}
