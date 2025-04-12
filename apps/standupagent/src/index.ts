import { App, HttpPlugin } from "@microsoft/spark.apps";
import { DevtoolsPlugin } from "@microsoft/spark.dev";
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
    const standup = await ensureStandupInitialized({ send });
    if (!standup) {
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
      standup
    );
  }
);

// Handle dialog events
app.on("dialog.open", async ({ activity, send }) => {
  const standup = await ensureStandupInitialized({
    send,
  });
  if (!standup) return;
  return handleDialogOpen(activity, standup);
});

app.on("dialog.submit", async ({ activity, send }) => {
  const standup = await ensureStandupInitialized({ send });
  if (!standup) return;

  const response = await handleDialogSubmit(activity, send, standup);
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
  const standup = await ensureStandupInitialized({ send });
  if (!standup) return;

  const response = await handleCardAction(activity, send, api, standup);
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
        "Add 'API changes discussion' to the parking lot",
        "I need to discuss deployment workflow in the next standup",
        "Add monitoring setup to parking lot",
      ],
    },
    {
      id: "get_parking_lot",
      name: "Get Parking Lot Items",
      description: "Retrieve all current parking lot items.",
      tags: ["parking-lot", "list"],
      examples: [
        "Show me the parking lot items",
        "What's in the parking lot?",
        "List all items in parking lot",
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
