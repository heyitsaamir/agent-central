
export interface UserSettings {
    userId: string;
    tenantId: string;
    standupGroups: string[]; // conversationIds of standup groups user participates in
    defaultStandupGroup?: string; // conversationId of default standup group
    lastUpdated: Date;
}

export interface UserSettingsManager {
    getUserSettings(userId: string, tenantId: string): Promise<UserSettings | null>;
    updateUserSettings(settings: UserSettings): Promise<void>;
    addStandupGroup(userId: string, tenantId: string, standupGroupId: string): Promise<void>;
    removeStandupGroup(userId: string, tenantId: string, standupGroupId: string): Promise<void>;
    setDefaultStandup(userId: string, tenantId: string, standupGroupId: string): Promise<void>;
}
