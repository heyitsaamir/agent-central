import { StandupCoordinator } from "../models/StandupCoordinator";
import { Result } from "../models/types";

let standupInstance: StandupCoordinator | null = null;

export async function ensureStandupInitialized(): Promise<Result<StandupCoordinator>> {
  if (!standupInstance) {
    try {
      const mongoConnectionString = process.env.MONGO_CONNECTION_STRING || process.env.COSMOS_CONNECTION_STRING;
      if (!mongoConnectionString) {
        console.error(
          "Error: MONGO_CONNECTION_STRING environment variable not set"
        );
        return {
          type: "error",
          message: "MONGO_CONNECTION_STRING environment variable not set",
        };
      }
      const initializingStandup = new StandupCoordinator();
      await initializingStandup.initialize(mongoConnectionString);
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
