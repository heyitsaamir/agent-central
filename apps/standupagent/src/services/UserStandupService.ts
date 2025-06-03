import { Result } from "../models/types";
import { BaseStorageItem, CosmosStorageFactory, IStorage } from "./CosmosStorage";
import { FileStorageFactory } from "./FileStorage";
import { InMemoryStorageFactory } from "./InMemoryStorage";
import { StandupGroupService } from "./StandupGroupService";
import { UserSettingsService, UserSettingsStorageItem } from "./UserSettingsService";

const useLocalStorage = process.env.USE_LOCAL_STORAGE === "true";
const useFileStorage = process.env.USE_FILE_STORAGE === "true";

export class UserStandupService {
    private userSettingsService!: UserSettingsService;
    private groupService!: StandupGroupService;

    constructor(groupService?: StandupGroupService) {
        if (groupService) {
            this.groupService = groupService;
        }
    }

    async initialize(cosmosConnectionString: string, groupService?: StandupGroupService): Promise<void> {
        // Set group service if provided during initialization
        if (groupService) {
            this.groupService = groupService;
        }

        let factory: <
            TKey extends string | number = string,
            TValue extends BaseStorageItem = BaseStorageItem
        >(
            databaseName: string,
            containerName: string,
            tenantId: string
        ) => IStorage<TKey, TValue> | Promise<IStorage<TKey, TValue>>;
        if (useLocalStorage) {
            factory = InMemoryStorageFactory.getStorage;
        } else if (useFileStorage) {
            factory = FileStorageFactory.getStorage;
        } else {
            CosmosStorageFactory.initialize(cosmosConnectionString);
            factory = CosmosStorageFactory.getStorage
        }

        const userSettingsStorage: IStorage<string, UserSettingsStorageItem> = await factory(
            "StandupDB",
            "UserSettings",
            "/tenantId"
        );

        this.userSettingsService = new UserSettingsService(userSettingsStorage);
    }

    async getUserSettings(userId: string, tenantId: string): Promise<Result<{ settings: any }>> {
        try {
            const settings = await this.userSettingsService.getUserSettings(userId, tenantId);
            return {
                type: "success",
                data: { settings },
                message: "User settings retrieved successfully"
            };
        } catch (error) {
            return {
                type: "error",
                message: `Failed to get user settings: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async setDefaultStandup(userId: string, tenantId: string, standupGroupId: string): Promise<Result<{ message: string }>> {
        try {
            await this.userSettingsService.setDefaultStandup(userId, tenantId, standupGroupId);
            return {
                type: "success",
                data: { message: "Default standup set successfully" },
                message: "Default standup set successfully"
            };
        } catch (error) {
            return {
                type: "error",
                message: error instanceof Error ? error.message : 'Failed to set default standup'
            };
        }
    }



    async getStandupsForUser(userId: string, tenantId: string): Promise<Result<{ standups: Array<{ conversationId: string; isDefault: boolean }> }>> {
        try {
            if (!this.groupService) {
                throw new Error("GroupService not initialized");
            }

            const allGroups = await this.groupService.getAllGroups(tenantId);
            const userSettings = await this.userSettingsService.getUserSettings(userId, tenantId);
            const userStandups = (await Promise.all(
                allGroups.map(async (group) => {
                    const users = await group.getUsers();
                    if (users.some(u => u.id === userId)) {
                        return {
                            conversationId: group.conversationId,
                            isDefault: group.conversationId === userSettings?.defaultStandupGroup
                        };
                    }
                    return null;
                })
            )).filter((g): g is { conversationId: string; isDefault: boolean } => g !== null);
            if (userStandups.length === 1) {
                userStandups[0].isDefault = true; // If only one standup, set it as default
            }

            return {
                type: "success",
                data: { standups: userStandups },
                message: "User standups retrieved successfully"
            };
        } catch (error) {
            console.error("Error getting user standups:", error);
            return {
                type: "error",
                message: `Failed to get user standups: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async getPersonalHistoricalStandups(
        userId: string,
        tenantId: string
    ): Promise<
        Result<{
            histories: Array<{
                date: Date;
                groupName?: string;
                responses: Array<{
                    userName: string;
                    completedWork: string;
                    plannedWork: string;
                    parkingLot?: string;
                }>;
            }>;
        }>
    > {
        try {
            if (!this.groupService) {
                throw new Error("GroupService not initialized");
            }

            // For individual users, get their history across all groups
            const allGroups = await this.groupService.getAllGroups(tenantId);
            const userHistories = await Promise.all(
                allGroups.map(async (group) => {
                    const histories = await this.groupService.getStandupHistoryForGroup(group);
                    return histories.map((h) => ({
                        date: new Date(h.date),
                        groupName: group.conversationId,
                        responses: h.responses
                            .filter((r) => r.userId === userId)
                            .map((r) => {
                                const user = h.participants.find((p) => p.id === r.userId);
                                return {
                                    userName: user ? user.name : "Unknown",
                                    completedWork: r.completedWork,
                                    plannedWork: r.plannedWork,
                                    parkingLot: r.parkingLot,
                                };
                            }),
                    }));
                })
            );

            type HistoryItem = {
                date: Date;
                groupName?: string;
                responses: Array<{
                    userName: string;
                    completedWork: string;
                    plannedWork: string;
                    parkingLot?: string;
                }>;
            };

            const flattenedHistories = userHistories
                .flat()
                .filter((h: HistoryItem) => h.responses.length > 0)
                .map((h) => ({
                    ...h,
                    date: new Date(h.date), // Ensure date is a proper Date object
                }))
                .sort(
                    (a: HistoryItem, b: HistoryItem) =>
                        b.date.getTime() - a.date.getTime()
                );

            return {
                type: "success",
                data: {
                    histories: flattenedHistories,
                },
                message: "History retrieved successfully",
            };
        } catch (error) {
            return {
                type: "error",
                message: `Failed to get personal history: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}
