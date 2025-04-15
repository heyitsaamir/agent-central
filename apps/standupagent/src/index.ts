import { App, HttpPlugin } from "@microsoft/teams.apps";
import { DevtoolsPlugin } from "@microsoft/teams.dev";
import { A2AServer, schema } from "a2aserver";
import { parkingLotAgentLogic } from "./a2a/handlers/parking";
import { handleCardAction } from "./handlers/cardActions";
import { handleDialogOpen, handleDialogSubmit } from "./handlers/dialog";
import { handleMessage } from "./handlers/message";
import { ensureStandupInitialized } from "./utils/initializeStandup";

const httpPlugin = new HttpPlugin();

const app = new App({
  plugins: [new DevtoolsPlugin(), httpPlugin],
});

// Handle incoming messages
app.on(
  "message",
  async ({ send, activity, isSignedIn, signin, signout, api }) => {
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
  await send("Yo yo whassap? I'm a standup bot. I help you conduct standups.");
});

// Handle sign in
app.event("signin", async ({ send }) => {
  await send("You are signed in!");
});

const parkingLotCard: schema.AgentCard = {
  name: "Standup Parking Lot",
  description: "An agent that manages parking lot items for team standups.",
  url: "http://localhost:3000/a2a",
  provider: {
    organization: "Standup Bot",
  },
  version: "0.0.1",
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  authentication: null,
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  skills: [
    {
      id: "add_parking_lot",
      name: "Add to Parking Lot",
      description: "Add a new item to the parking lot for discussion.",
      tags: ["parking-lot", "add"],
      examples: [
        "Add 'API changes discussion' to the parking lot for conversation id 123",
        "I need to discuss deployment workflow in the next standup for conversation id 123",
        "Add monitoring setup to parking lot for conversation id 123",
      ],
    },
    {
      id: "get_parking_lot",
      name: "Get Parking Lot Items",
      description:
        "Retrieve all current parking lot items for a given conversation id",
      tags: ["parking-lot", "list"],
      examples: [
        "Show me the parking lot items for conversation id 123",
        "What's in the parking lot for conversation id 123?",
        "List all items in parking lot for conversation id 123",
      ],
    },
  ],
};

const a2aServer = new A2AServer(
  parkingLotAgentLogic,
  (httpPlugin as any).express,
  {
    card: parkingLotCard,
    basePath: "/a2a",
  }
);

(async () => {
  await a2aServer.start();
  await app.start(+(process.env.PORT || 3000));
})();
