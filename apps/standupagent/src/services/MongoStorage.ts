import { MongoClient, Db, Collection } from "mongodb";
import { StandupResponse, User } from "../models/types";

export interface IStorage<
    TKey = any,
    TValue extends BaseStorageItem = BaseStorageItem,
> {
    get(
        key: TKey,
        tenantId?: string
    ): TValue | undefined | Promise<TValue | undefined>;
    set(key: TKey, value: TValue): void | Promise<void>;
    delete(key: TKey, tenantId?: string): void | Promise<void>;
    queryByTenantId?(tenantId: string): Promise<TValue[]>;
}

export class MongoStorage<
    TKey extends string | number = string,
    TValue extends BaseStorageItem = BaseStorageItem,
> implements IStorage<TKey, TValue> {
    constructor(
        private collection: Collection<TValue>
    ) { }

    async get(key: TKey, tenantId: string): Promise<TValue | undefined> {
        try {
            const result = await this.collection.findOne({
                id: key.toString(),
                tenantId: tenantId
            } as any);
            if (!result) return undefined;
            // Remove MongoDB's _id field before returning
            const { _id, ...rest } = result as any;
            return rest as TValue;
        } catch (error) {
            throw error;
        }
    }

    async set(key: TKey, value: TValue): Promise<void> {
        if (!value.tenantId) {
            throw new Error("tenantId is required for partition key");
        }
        await this.collection.updateOne(
            { id: key.toString(), tenantId: value.tenantId } as any,
            { $set: value },
            { upsert: true }
        );
    }

    async delete(key: TKey, tenantId: string): Promise<void> {
        await this.collection.deleteOne({
            id: key.toString(),
            tenantId: tenantId
        } as any);
    }

    async queryByTenantId(tenantId: string): Promise<TValue[]> {
        const results = await this.collection.find({
            tenantId: tenantId
        } as any).toArray();
        // Remove MongoDB's _id field from all results
        return results.map((doc: any) => {
            const { _id, ...rest } = doc;
            return rest as TValue;
        });
    }
}

export class MongoStorageFactory {
    private static client: MongoClient;
    private static db: Db;
    private static collections = new Map<string, Collection<any>>();

    static async initialize(connectionString: string) {
        MongoStorageFactory.client = new MongoClient(connectionString);
        await MongoStorageFactory.client.connect();
    }

    static async getStorage<
        TKey extends string | number = string,
        TValue extends BaseStorageItem = BaseStorageItem,
    >(
        databaseName: string,
        collectionName: string,
        _partitionKeyPath: string = "/tenantId" // Keep for API compatibility but not used in MongoDB
    ): Promise<MongoStorage<TKey, TValue>> {
        // Validate initialization
        if (!MongoStorageFactory.client) {
            throw new Error(
                "MongoStorageFactory not initialized. Call initialize() first."
            );
        }

        const cacheKey = `${databaseName}:${collectionName}`;

        if (!MongoStorageFactory.collections.has(cacheKey)) {
            try {
                // Get or create database
                MongoStorageFactory.db = MongoStorageFactory.client.db(databaseName);

                // Get collection (MongoDB creates collections automatically)
                const collection = MongoStorageFactory.db.collection<any>(collectionName);

                // Create indexes for better performance
                await collection.createIndex({ id: 1, tenantId: 1 }, { unique: true });
                await collection.createIndex({ tenantId: 1 });

                MongoStorageFactory.collections.set(cacheKey, collection);
            } catch (error) {
                throw new Error(
                    `Failed to initialize storage for ${collectionName}: ${error}`
                );
            }
        }

        return new MongoStorage<TKey, TValue>(MongoStorageFactory.collections.get(cacheKey)!);
    }

    static async close() {
        if (MongoStorageFactory.client) {
            await MongoStorageFactory.client.close();
        }
    }
}

export interface StandupSummary {
    date: Date;
    participants: User[];
    responses: StandupResponse[];
    parkingLot?: string[];
}

// Unified storage type
export interface BaseStorageItem {
    id: string; // conversationId
    tenantId: string; // partition key
}

export interface GroupStorageItem extends BaseStorageItem {
    readonly type: "group";
    users: User[];
    startedAt: string | null;
    activeResponses: StandupResponse[];
    storage: {
        type: string;
        targetId?: string;
    };
    activeStandupActivityId: string | null;
    saveHistory: boolean;
    customInstructions: string | null;
    conversationName: string | null
}

export interface HistoryStorageItem extends BaseStorageItem {
    readonly type: "history";
    summaries: StandupSummary[];
}
