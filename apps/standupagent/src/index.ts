import { App } from "@microsoft/teams.apps";
import pkg from "../package.json";
import { handleCardAction } from "./handlers/cardActions";
import { handleDialogOpen, handleDialogSubmit } from "./handlers/dialog";
import { handleMessage } from "./handlers/message";
import { ensureStandupInitialized } from "./utils/initializeStandup";
import { ManagedIdentityCredential } from '@azure/identity'

const PORT = +(process.env.PORT || 3000);

const createTokenFactory = () => {
    return async (scope: string | string[], tenantId?: string): Promise<string> => {
        const managedIdentityCredential = new ManagedIdentityCredential({
            clientId: process.env.MANAGED_IDENTITY_CLIENT_ID
        });
        const scopes = Array.isArray(scope) ? scope : [scope];
        const tokenResponse = await managedIdentityCredential.getToken(scopes, {
            tenantId: tenantId
        });

        return tokenResponse.token;
    };
};

const app = new App({
    token: createTokenFactory()
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
app.on("dialog.open", async ({ activity }) => {
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

app.start(PORT).catch(console.error)

