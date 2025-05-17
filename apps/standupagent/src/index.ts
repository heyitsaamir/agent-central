import { A2APlugin } from "@microsoft/teams.a2a";
import { App, HttpPlugin } from "@microsoft/teams.apps";
import pkg from "../package.json";
import { buildStandupAgentCard } from "./a2a/agentCard";
import { parkingLotAgentLogic } from "./a2a/handlers/parking";
import { handleCardAction } from "./handlers/cardActions";
import { handleDialogOpen, handleDialogSubmit } from "./handlers/dialog";
import { handleMessage } from "./handlers/message";
import { ensureStandupInitialized } from "./utils/initializeStandup";

const httpPlugin = new HttpPlugin();

const PORT = +(process.env.PORT || 3000);
const hostName = process.env.WEBSITE_HOSTNAME || `localhost:${PORT}`;

const app = new App({
  plugins: [httpPlugin, new A2APlugin({
    agentCard: buildStandupAgentCard(hostName),
  })],
});

// Handle incoming messages
app.on(
  "message",
  async ({ send, activity, isSignedIn, signin, signout, api }) => {
    console.log(
      `Handling message using teams app version ${pkg.dependencies["@microsoft/teams.apps"]}`
    );
    console.log("Received message:", activity);
    const standup = await ensureStandupInitialized();
    if (standup.type === "error") {
      await send(standup.message);
      console.log("Standup not initialized");
      return;
    }

    await handleMessage(
      activity,
      {
        send,
        signin,
        api,
        signout,
        isSignedIn,
        app,
      },
      standup.data
    );
  }
);

// Handle dialog events
app.on("dialog.open", async ({ activity, send }) => {
  const standup = await ensureStandupInitialized();
  if (standup.type === "error") return;
  return handleDialogOpen(activity, standup.data);
});

app.on("dialog.submit", async ({ activity, send }) => {
  const standup = await ensureStandupInitialized();
  if (standup.type === "error") {
    console.error(standup.message);
    return;
  }

  const response = await handleDialogSubmit(activity, send, standup.data);
  return {
    status: response?.status || 200,
    body: {
      task: {
        type: "message",
        value: response?.body?.task?.value || "",
      },
    },
  };
});

// Handle card actions
app.on("card.action", async ({ activity, send, api }) => {
  const standup = await ensureStandupInitialized();
  if (standup.type === "error") {
    console.error(standup.message);
    return;
  }

  const response = await handleCardAction(activity, send, api, standup.data);
  return {
    statusCode: 200,
    type: "application/vnd.microsoft.activity.message",
    value: response?.value || "",
  };
});

// Handle installation
app.on("install.add", async ({ send }) => {
  await send("Hello! I am a Standup Agent. I can help you manage your standups.");
});

// Handle sign in
app.event("signin", async ({ send }) => {
  await send("You are signed in!");
});

app.event('a2a:message', async ({ respond, taskContext }) => {
  const result = await parkingLotAgentLogic(taskContext);
  await respond
});

(async () => {
  await app.start(PORT);
})();

