import { App, HttpPlugin } from "@microsoft/teams.apps";
import { DevtoolsPlugin } from "@microsoft/teams.dev";
import { A2AServer } from "a2aserver";
import * as dotenv from "dotenv";
import { supportAgentCard, supportAgentLogic } from "./a2a/handlers/support";
import { ConfigHandler } from "./config/handler";
import { SupportHandler } from "./handler";

// Load environment variables from .env file
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_API_VERSION",
  "AZURE_OPENAI_MODEL_DEPLOYMENT_NAME",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const httpPlugin = new HttpPlugin();

const app = new App({
  plugins: [new DevtoolsPlugin(), httpPlugin],
});

const supportHandler = new SupportHandler();
const configHandler = new ConfigHandler();

app.on("message", async ({ send, activity }) => {
  console.log("Received message:", activity);
  await send({ type: "typing" });

  try {
    const response = await supportHandler.processMessage(
      activity.text,
      activity
    );
    await send(response.content);
  } catch (error) {
    console.error("Error processing message:", error);
    await send(
      "I encountered an error while processing your request. Please try again."
    );
  }
});

app.on("config.open", async ({ activity }) => {
  return configHandler.handleOpen(activity);
});

app.on("config.submit", async ({ activity }) => {
  return configHandler.handleSubmit(activity);
});

const a2aServer = new A2AServer(
  supportAgentLogic,
  (httpPlugin as any).express,
  {
    card: supportAgentCard,
    basePath: "/a2a",
  }
);

(async () => {
  await a2aServer.start();
  await app.start(+(process.env.PORT || 8000));
  console.log("Support agent is running with A2A capabilities!");
})();
