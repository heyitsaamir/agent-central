import { A2APlugin } from "@microsoft/teams.a2a";
import { App } from "@microsoft/teams.apps";
import { DevtoolsPlugin } from "@microsoft/teams.dev";
import * as dotenv from "dotenv";
import { supportAgentCard, supportAgentLogic2 } from "./a2a/handlers/support";
import { ConfigHandler } from "./config/handler";
import { FileStorage } from "./fileStorage";
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

const app = new App({
  plugins: [
    new DevtoolsPlugin(),
    new A2APlugin({
      agentCard: supportAgentCard,
    }),
  ],
  storage: new FileStorage()
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

app.event('a2a:message', async ({ taskContext, respond, accumulateArtifacts }) => {
  const result = await supportAgentLogic2(taskContext, accumulateArtifacts);
  await respond(result);
});

(async () => {
  await app.start(+(process.env.PORT || 8000));
})();
