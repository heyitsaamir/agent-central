import { Standup } from "../models/Standup";

let standupInstance: Standup | null = null;

export async function ensureStandupInitialized({
  send,
}: {
  send: (message: any) => Promise<any>;
}): Promise<Standup | null> {
  if (!standupInstance) {
    try {
      const cosmosConnectionString = process.env.COSMOS_CONNECTION_STRING;
      if (!cosmosConnectionString) {
        await send(
          "Error: COSMOS_CONNECTION_STRING environment variable not set"
        );
        console.error(
          "Error: COSMOS_CONNECTION_STRING environment variable not set"
        );
        return null;
      }
      const initializingStandup = new Standup();
      await initializingStandup.initialize(cosmosConnectionString);
      standupInstance = initializingStandup;
      console.log("Standup initialized successfully!");
      return initializingStandup;
    } catch (error) {
      console.error("Error initializing Standup:", error);
      return null;
    }
  }

  return standupInstance;
}
