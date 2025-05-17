import { schema } from "@microsoft/teams.a2a";

export const buildStandupAgentCard = (hostname: string): schema.AgentCard => ({
    name: "Standup Agent",
    description: "An agent that manages standups and helps teams keep on track with important priorities for the next discussion.",
    url: `http://${hostname}/a2a`,
    provider: {
        organization: "Agent Central",
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
                "Add 'API changes discussion' to the parking lot for conversation id 123@thread.v2",
                "I need to discuss deployment workflow in the next standup for conversation id 123@thread.v2",
                "Add monitoring setup to parking lot for conversation id 123@thread.v2",
            ],
        },
        {
            id: "get_parking_lot",
            name: "Get Parking Lot Items",
            description:
                "Retrieve all current parking lot items for a given conversation id",
            tags: ["parking-lot", "list"],
            examples: [
                "Show me the parking lot items for conversation id 123@thread.v2",
                "What's in the parking lot for conversation id 123@thread.v2?",
                "List all items in parking lot for conversation id 12@thread.v2",
            ],
        },
    ],
});