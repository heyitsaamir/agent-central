import { StandupGroup } from "../models/StandupGroup";
import { User } from "../models/types";
import { PersistentStandupService } from "./PersistentStandupService";
import { IStandupStorage } from "./Storage";

export class StandupGroupManager {
    constructor(private persistentService: PersistentStandupService) { }

    async wrapGroup(group: StandupGroup): Promise<StandupGroup> {
        // Create a proxy to intercept state-changing methods and persist after changes
        return new Proxy(group, {
            get: (target, prop: string | symbol) => {
                const value = target[prop as keyof StandupGroup];
                if (typeof value === "function") {
                    return async (...args: any[]) => {
                        // Preserve the 'this' context
                        const originalMethod = (value as Function).bind(target);
                        const result = await originalMethod(...args);

                        // After any state-changing method, persist the group
                        if (
                            [
                                "addUser",
                                "removeUser",
                                "startStandup",
                                "addResponse",
                                "addParkingLotItem",
                                "closeStandup",
                                "setSaveHistory",
                                "addWorkItem",
                                "clearParkingLot",
                                "setCustomInstructions"
                            ].includes(prop as string)
                        ) {
                            await this.persistentService.saveGroup(target);
                        }

                        return result;
                    };
                }
                return value;
            },
        });
    }

    async createGroup(
        conversationId: string,
        storage: IStandupStorage,
        creator: User,
        tenantId: string,
        saveHistory: boolean = false
    ): Promise<StandupGroup> {
        const group = new StandupGroup(
            conversationId,
            storage,
            tenantId,
            this.persistentService,
            [creator],
            [],
            null,
            null,
            saveHistory
        );
        await this.persistentService.saveGroup(group);
        return this.wrapGroup(group);
    }

    async loadGroup(
        conversationId: string,
        tenantId: string
    ): Promise<StandupGroup | null> {
        const group = await this.persistentService.loadGroup(
            conversationId,
            tenantId
        );
        if (!group) return null;
        return this.wrapGroup(group);
    }

    async getAllGroups(tenantId: string): Promise<StandupGroup[]> {
        const groups = await this.persistentService.getAllGroups(tenantId);
        return Promise.all(groups.map((group) => this.wrapGroup(group)));
    }
}
