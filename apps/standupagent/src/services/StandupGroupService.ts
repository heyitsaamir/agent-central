import { IAdaptiveCard } from "@microsoft/teams.cards";
import { createStandupCard, createStandupSummaryCard } from "../models/AdaptiveCards";
import { StandupGroup } from "../models/StandupGroup";
import { Result, StandupResponse, User } from "../models/types";
import { PersistentStandupService } from "./PersistentStandupService";
import { StandupGroupManager } from "./StandupGroupManager";
import { IStandupStorage } from "./Storage";

export class StandupGroupService {
    private persistentService: PersistentStandupService;
    private groupManager: StandupGroupManager;

    constructor() {
        this.persistentService = new PersistentStandupService();
        this.groupManager = new StandupGroupManager(this.persistentService);
    }

    async initialize(cosmosConnectionString: string): Promise<void> {
        await this.persistentService.initialize(cosmosConnectionString);
    }

    async registerGroup(
        conversationId: string,
        storage: IStandupStorage,
        creator: User,
        tenantId: string,
        includeHistory: boolean = false
    ): Promise<Result<{ message: string }>> {
        const existingGroup = await this.persistentService.loadGroup(
            conversationId,
            tenantId
        );
        if (existingGroup) {
            return {
                type: "error",
                message: "A standup group is already registered for this conversation.",
            };
        }

        const group = await this.groupManager.createGroup(
            conversationId,
            storage,
            creator,
            tenantId,
            includeHistory
        );
        return {
            type: "success",
            data: { message: "Standup group registered successfully!" },
            message: "Standup group registered successfully!",
        };
    }

    async addUsers(
        conversationId: string,
        users: User[],
        tenantId: string
    ): Promise<Result<{ message: string }>> {
        const group = await this.validateGroup(conversationId, tenantId);
        if (!group) {
            return {
                type: "error",
                message:
                    "No standup group registered. Use !register <onenote-link> to create one.",
            };
        }

        if (!users.length) {
            return {
                type: "error",
                message: "Please @mention the users you want to add.",
            };
        }

        const addedUsers: string[] = [];
        for (const user of users) {
            if (await group.addUser(user)) {
                addedUsers.push(user.name);
            }
        }

        if (addedUsers.length > 0) {
            const message = `Added users: ${addedUsers.join(", ")}`;
            return {
                type: "success",
                data: { message },
                message,
            };
        }
        return {
            type: "error",
            message: "No new users were added (they might already be in the group).",
        };
    }

    async removeUsers(
        conversationId: string,
        userIds: string[],
        tenantId: string
    ): Promise<Result<{ message: string }>> {
        const group = await this.validateGroup(conversationId, tenantId);
        if (!group) {
            return {
                type: "error",
                message:
                    "No standup group registered. Use !register <onenote-link> to create one.",
            };
        }

        if (!userIds.length) {
            return {
                type: "error",
                message: "Please @mention the users you want to remove.",
            };
        }

        const removedUsers: string[] = [];
        const users = await group.getUsers();
        for (const userId of userIds) {
            if (await group.removeUser(userId)) {
                const user = users.find((u: User) => u.id === userId);
                if (user) {
                    removedUsers.push(user.name);
                }
            }
        }

        if (removedUsers.length > 0) {
            const message = `Removed users: ${removedUsers.join(", ")}`;
            return {
                type: "success",
                data: { message },
                message,
            };
        }
        return {
            type: "error",
            message: "No users were removed (they might not be in the group).",
        };
    }

    async startStandup(
        conversationId: string,
        tenantId: string,
        activityId?: string
    ): Promise<Result<{ message: string; previousParkingLot?: string[] }>> {
        const group = await this.validateGroup(conversationId, tenantId);
        if (!group) {
            return {
                type: "error",
                message:
                    "No standup group registered. Use !register <onenote-link> to create one.",
            };
        }

        if (await group.isStandupActive()) {
            return {
                type: "error",
                message: "A standup is already in progress.",
            };
        }

        if ((await group.getUsers()).length === 0) {
            return {
                type: "error",
                message: "No users in the standup group. Add users with !add @user",
            };
        }

        const result = await group.startStandup(activityId);
        return {
            type: "success",
            data: {
                message: "Starting standup...",
                previousParkingLot: result.previousParkingLot,
            },
            message: "Starting standup...",
        };
    }

    async submitResponse(
        conversationId: string,
        response: StandupResponse,
        tenantId: string,
        send?: (activity: any) => Promise<any>
    ): Promise<Result<{ message: string }>> {
        const group = await this.validateGroup(conversationId, tenantId);
        if (!group) {
            return {
                type: "error",
                message: "No standup group registered.",
            };
        }

        if (!send) {
            return {
                type: "error",
                message: "No send function provided.",
            };
        }

        if (!response.completedWork || !response.plannedWork) {
            return {
                type: "error",
                message: "Please provide both completed and planned work updates.",
            };
        }

        if (await group.addResponse(response)) {
            // Update standup card with new response
            const activityId = await group.getActiveStandupActivityId();
            if (activityId) {
                const users = await group.getUsers();
                const responses = await group.getActiveResponses();
                const completedUsers = responses.map((r) => {
                    const user = users.find((u) => u.id === r.userId);
                    return user ? user.name : "Unknown";
                });

                // Get previous parking lot items from storage
                const history = await this.persistentService.getStandupHistory(group);
                const previousParkingLot =
                    history.length > 0
                        ? history[history.length - 1].parkingLot
                        : undefined;

                // Update the original card with completed responses and maintain parking lot items
                await send({
                    type: "message",
                    id: activityId,
                    attachments: [
                        {
                            contentType: "application/vnd.microsoft.card.adaptive",
                            content: createStandupCard(completedUsers, previousParkingLot),
                        },
                    ],
                });
            }

            return {
                type: "success",
                data: { message: "Your standup response has been recorded." },
                message: "Your standup response has been recorded.",
            };
        }
        return {
            type: "error",
            message:
                "Could not record response. Make sure a standup is active and you haven't already responded.",
        };
    }

    async closeStandup(
        conversationId: string,
        tenantId: string,
        toBeRestarted: boolean = false
    ): Promise<
        Result<{
            message: string;
            summary?: IAdaptiveCard;
        }>
    > {
        const group = await this.validateGroup(conversationId, tenantId);
        if (!group) {
            return {
                type: "error",
                message: "No standup group registered.",
            };
        }

        const responses = await group.closeStandup(toBeRestarted);
        if (toBeRestarted) {
            return {
                type: "success",
                data: {
                    message: "Standup closed successfully without sending summary",
                },
                message: "Standup closed successfully without sending summary",
            };
        }
        if (responses.length === 0) {
            return {
                type: "error",
                message: "No responses were recorded for this standup.",
            };
        }

        const users = await group.getUsers();
        const formattedResponses = responses.map((r: StandupResponse) => {
            const user = users.find((u: User) => u.id === r.userId);
            return {
                userName: user ? user.name : "Unknown",
                completedWork: r.completedWork,
                plannedWork: r.plannedWork,
                parkingLot: r.parkingLot,
            };
        });

        const persistResult = await group.persistStandup();

        let message;
        if (persistResult.type === "error") {
            message = `Standup closed successfully, but failed to save to storage: ${persistResult.message}`;
        } else {
            message = "Standup closed and saved successfully.";
        }
        return {
            type: "success",
            data: {
                message,
                summary: createStandupSummaryCard(formattedResponses),
            },
            message,
        };
    }

    async validateGroup(
        conversationId: string,
        tenantId: string
    ): Promise<StandupGroup | null> {
        return await this.groupManager.loadGroup(conversationId, tenantId);
    }

    async getParkingLotItems(
        conversationId: string,
        tenantId: string
    ): Promise<
        Result<{ parkingLotItems: Array<{ item: string; userName: string | null }> }>
    > {
        const group = await this.validateGroup(conversationId, tenantId);
        if (!group) {
            return {
                type: "error",
                message:
                    "No standup group registered. Use !register <onenote-link> to create one.",
            };
        }

        const users = await group.getUsers();
        const responses = await group.getActiveResponses();
        const parkingLotItems = responses
            .filter((r) => r.parkingLot)
            .flatMap((r) => {
                const user = users.find((u) => u.id === r.userId);
                return r.parkingLot!.split("\n").map((item) => ({
                    item,
                    userName: user ? user.name : null,
                }));
            });

        return {
            type: "success",
            data: { parkingLotItems },
            message: "Parking lot items retrieved successfully",
        };
    }

    async clearParkingLot(
        conversationId: string,
        tenantId: string,
        userId: string | null,
    ): Promise<Result<{ message: string }>> {
        const group = await this.validateGroup(conversationId, tenantId);
        if (!group) {
            return {
                type: "error",
                message:
                    "No standup group registered. Use !register <onenote-link> to create one.",
            };
        }
        const responses = await group.getActiveResponses();
        await group.clearParkingLot(userId);
        return {
            type: "success",
            data: { message: "Parking lot cleared successfully." },
            message: "Parking lot cleared successfully.",
        };
    }

    async getGroupDetails(
        conversationId: string,
        tenantId: string
    ): Promise<
        Result<{ members: User[]; isActive: boolean; storageType: string }>
    > {
        const group = await this.validateGroup(conversationId, tenantId);
        if (!group) {
            return {
                type: "error",
                message:
                    "No standup group registered. Use !register <onenote-link> to create one.",
            };
        }

        const members = await group.getUsers();
        const isActive = await group.isStandupActive();
        const storageType = group.storage.constructor.name.replace("Storage", "");

        return {
            type: "success",
            data: {
                members,
                isActive,
                storageType,
            },
            message: "Group details retrieved successfully",
        };
    }

    async getGroupHistoricalStandups(
        conversationId: string,
        tenantId: string
    ): Promise<
        Result<{
            histories: Array<{
                date: Date;
                responses: Array<{
                    userName: string;
                    completedWork: string;
                    plannedWork: string;
                    parkingLot?: string;
                }>;
            }>;
        }>
    > {
        const group = await this.validateGroup(conversationId, tenantId);
        if (!group) {
            return {
                type: "error",
                message: "No standup group found for this conversation.",
            };
        }

        const histories = await this.persistentService.getStandupHistory(group);
        return {
            type: "success",
            data: {
                histories: histories.map((h) => ({
                    date: new Date(h.date),
                    responses: h.responses.map((r) => {
                        const user = h.participants.find((p) => p.id === r.userId);
                        return {
                            userName: user ? user.name : "Unknown",
                            completedWork: r.completedWork,
                            plannedWork: r.plannedWork,
                            parkingLot: r.parkingLot,
                        };
                    }),
                })),
            },
            message: "History retrieved successfully",
        };
    }

    // Helper method to get all groups for a tenant (needed by UserStandupService)
    async getAllGroups(tenantId: string): Promise<StandupGroup[]> {
        return await this.groupManager.getAllGroups(tenantId);
    }

    // Helper method to get standup history for a group (needed by UserStandupService)
    async getStandupHistoryForGroup(group: StandupGroup) {
        return await this.persistentService.getStandupHistory(group);
    }
}
