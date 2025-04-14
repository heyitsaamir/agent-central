import { App } from "@microsoft/spark.apps";
import { DevtoolsPlugin } from "@microsoft/spark.dev";
import * as dotenv from "dotenv";
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

const app = new App({
  plugins: [new DevtoolsPlugin()],
});

const supportHandler = new SupportHandler();
const configHandler = new ConfigHandler();

app.on("message", async ({ send, activity }) => {
  await send({ type: "typing" });

  try {
    const response = await supportHandler.processMessage(
      activity.text,
      activity
    );
    await send(response);
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

(async () => {
  await app.start(+(process.env.PORT || 6000));
  console.log("Support agent is running!");
})();
