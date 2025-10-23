import { UserSettings, UserSettingsManager } from "../models/UserSettings";
import { IStorage } from "./MongoStorage";

export interface UserSettingsStorageItem extends UserSettings {
    id: string;
    type: "userSettings";
}

export class UserSettingsService implements UserSettingsManager {
    constructor(
        private userSettingsStorage: IStorage<string, UserSettingsStorageItem>
    ) { }

    private getUserKey(userId: string): string {
        return `user_${userId}`;
    }



    async getUserSettings(userId: string, tenantId: string): Promise<UserSettings | null> {
        const key = this.getUserKey(userId);
        const settings = await this.userSettingsStorage.get(key, tenantId);
        if (!settings) return null;

        return {
            userId: settings.userId,
            tenantId: settings.tenantId,
            standupGroups: settings.standupGroups,
            defaultStandupGroup: settings.defaultStandupGroup,
            lastUpdated: settings.lastUpdated
        };
    }

    async updateUserSettings(settings: UserSettings): Promise<void> {
        const key = this.getUserKey(settings.userId);
        const storageItem: UserSettingsStorageItem = {
            id: key,
            type: "userSettings",
            ...settings,
            lastUpdated: new Date()
        };
        await this.userSettingsStorage.set(key, storageItem);
    }

    async addStandupGroup(userId: string, tenantId: string, standupGroupId: string): Promise<void> {
        let settings = await this.getUserSettings(userId, tenantId);
        if (!settings) {
            settings = {
                userId,
                tenantId,
                standupGroups: [],
                lastUpdated: new Date()
            };
        }

        if (!settings.standupGroups.includes(standupGroupId)) {
            settings.standupGroups.push(standupGroupId);

            // Auto-set as default if it's the only one
            if (settings.standupGroups.length === 1) {
                settings.defaultStandupGroup = standupGroupId;
            }

            await this.updateUserSettings(settings);
        }
    }

    async removeStandupGroup(userId: string, tenantId: string, standupGroupId: string): Promise<void> {
        const settings = await this.getUserSettings(userId, tenantId);
        if (!settings) return;

        settings.standupGroups = settings.standupGroups.filter(id => id !== standupGroupId);

        // Clear default if it was the removed group
        if (settings.defaultStandupGroup === standupGroupId) {
            settings.defaultStandupGroup = settings.standupGroups.length === 1
                ? settings.standupGroups[0]
                : undefined;
        }

        await this.updateUserSettings(settings);
    }

    async setDefaultStandup(userId: string, tenantId: string, standupGroupId: string): Promise<void> {
        const settings = await this.getUserSettings(userId, tenantId);
        if (!settings) {
            await this.addStandupGroup(userId, tenantId, standupGroupId)
            return
        }

        if (!settings.standupGroups.includes(standupGroupId)) {
            throw new Error("You are not a member of this standup group.");
        }

        settings.defaultStandupGroup = standupGroupId;
        await this.updateUserSettings(settings);
    }


}
