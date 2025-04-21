import { Container, CosmosClient, PartitionKeyDefinition } from "@azure/cosmos";
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

export class CosmosStorage<
  TKey extends string | number = string,
  TValue extends BaseStorageItem = BaseStorageItem,
> implements IStorage<TKey, TValue>
{
  constructor(
    private container: Container,
    private partitionKeyPath: string
  ) {}

  async get(key: TKey, tenantId: string): Promise<TValue | undefined> {
    try {
      const item = this.container.item(key.toString(), tenantId);
      const { resource } = await item.read<TValue>();
      return resource;
    } catch (error) {
      if ((error as any).code === 404) return undefined;
      throw error;
    }
  }

  async set(key: TKey, value: TValue): Promise<void> {
    if (!value.tenantId) {
      throw new Error("tenantId is required for partition key");
    }
    await this.container.items.upsert(value);
  }

  async delete(key: TKey, tenantId: string): Promise<void> {
    await this.container.item(key.toString(), tenantId).delete();
  }

  async queryByTenantId(tenantId: string): Promise<TValue[]> {
    const querySpec = {
      query: "SELECT * FROM c WHERE c.tenantId = @tenantId",
      parameters: [{ name: "@tenantId", value: tenantId }],
    };
    const { resources } = await this.container.items
      .query<TValue>(querySpec)
      .fetchAll();
    return resources;
  }
}

export class CosmosStorageFactory {
  private static client: CosmosClient;
  private static containers = new Map<string, Container>();

  static initialize(connectionString: string) {
    this.client = new CosmosClient(connectionString);
  }

  static async getStorage<
    TKey extends string | number = string,
    TValue extends BaseStorageItem = BaseStorageItem,
  >(
    databaseName: string,
    containerName: string,
    partitionKeyPath: string = "/id"
  ): Promise<CosmosStorage<TKey, TValue>> {
    // Validate initialization
    if (!this.client) {
      throw new Error(
        "CosmosStorageFactory not initialized. Call initialize() first."
      );
    }

    const cacheKey = `${databaseName}:${containerName}`;

    if (!this.containers.has(cacheKey)) {
      try {
        // Create database if it doesn't exist
        const { database } = await this.client.databases.createIfNotExists({
          id: databaseName,
        });

        // Create container if it doesn't exist
        const { container } = await database.containers.createIfNotExists({
          id: containerName,
          partitionKey: {
            paths: [partitionKeyPath],
            kind: "Hash",
          } as PartitionKeyDefinition,
        });

        this.containers.set(cacheKey, container);
      } catch (error) {
        throw new Error(
          `Failed to initialize storage for ${containerName}: ${error}`
        );
      }
    }

    return new CosmosStorage(this.containers.get(cacheKey)!, partitionKeyPath);
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
  isActive: boolean;
  activeResponses: StandupResponse[];
  storage: {
    type: string;
    targetId?: string;
  };
  activeStandupActivityId: string | null;
  saveHistory: boolean;
}

export interface HistoryStorageItem extends BaseStorageItem {
  readonly type: "history"; // Make type readonly since it's a constant
  summaries: StandupSummary[];
}
