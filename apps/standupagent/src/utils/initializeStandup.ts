import { StandupCoordinator } from "../models/StandupCoordinator";
import { Result } from "../models/types";

let standupInstance: StandupCoordinator | null = null;

export async function ensureStandupInitialized(): Promise<Result<StandupCoordinator>> {
  if (!standupInstance) {
    try {
      const cosmosConnectionString = process.env.COSMOS_CONNECTION_STRING;
      if (!cosmosConnectionString) {
        console.error(
          "Error: COSMOS_CONNECTION_STRING environment variable not set"
        );
        return {
          type: "error",
          message: "COSMOS_CONNECTION_STRING environment variable not set",
        };
      }
      const initializingStandup = new StandupCoordinator();
      await initializingStandup.initialize(cosmosConnectionString);
      standupInstance = initializingStandup;
      console.log("Standup initialized successfully!");
      return {
        type: "success",
        message: "Standup initialized successfully!",
        data: standupInstance,
      };
    } catch (error) {
      console.error("Error initializing Standup:", error);
      return {
        type: "error",
        message: `Error initializing Standup: ${error}`,
      };
    }
  }

  return {
    type: "success",
    message: "Standup already initialized",
    data: standupInstance,
  };
}
