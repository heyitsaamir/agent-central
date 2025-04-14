import { App } from "@microsoft/spark.apps";
import { DevtoolsPlugin } from "@microsoft/spark.dev";
import { NLPHandler } from "./nlp";

const app = new App({
  plugins: [new DevtoolsPlugin()],
});

const nlpHandler = new NLPHandler();

app.on("message", async ({ send, activity }) => {
  await send({ type: "typing" });

  try {
    const response = await nlpHandler.processMessage(activity.text, activity);
    await send(response);
  } catch (error) {
    console.error("Error processing message:", error);
    await send(
      "I encountered an error while processing your request. Please try again."
    );
  }
});

(async () => {
  await app.start(+(process.env.PORT || 4000));
  console.log("Team management bot is running!");
})();
