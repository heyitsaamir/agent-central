import { StandupGroup } from "../models/StandupGroup";
import {
  CosmosStorageFactory,
  GroupStorageItem,
  HistoryStorageItem,
  IStorage,
  StandupSummary,
} from "./CosmosStorage";
import { InMemoryStorageFactory } from "./InMemoryStorage";
import { IStandupStorage, NoStorage } from "./Storage";

const useLocalStorage = process.env.USE_LOCAL_STORAGE === "true";

if (useLocalStorage) {
  console.warn("Using in-memory storage. This is not suitable for production.");
}

export class PersistentStandupService {
  private groupStorage!: IStorage<string, GroupStorageItem>;
  private historyStorage!: IStorage<string, HistoryStorageItem>;

  constructor(
    private databaseName: string = "StandupDB",
    private groupContainer: string = "StandupGroups",
    private historyContainer: string = "StandupHistory"
  ) {}

  private getStorageKey(group: StandupGroup): {
    id: string;
    tenantId: string;
  } {
    return {
      id: group.conversationId,
      tenantId: group.tenantId,
    };
  }

  async initialize(connectionString: string) {
    let factory: typeof CosmosStorageFactory | typeof InMemoryStorageFactory =
      CosmosStorageFactory;
    if (useLocalStorage) {
      factory = InMemoryStorageFactory;
    } else {
      // Initialize the CosmosDB client
      factory.initialize(connectionString);
    }

    // Get storage instances for groups and history
    this.groupStorage = await factory.getStorage<string, GroupStorageItem>(
      this.databaseName,
      this.groupContainer,
      "/tenantId"
    );

    this.historyStorage = await factory.getStorage<string, HistoryStorageItem>(
      this.databaseName,
      this.historyContainer,
      "/tenantId"
    );
  }

  async loadGroup(
    conversationId: string,
    tenantId: string
  ): Promise<StandupGroup | null> {
    // Use provided tenantId for lookup
    const key = { id: conversationId, tenantId };
    const data = await this.groupStorage.get(key.id, key.tenantId);
    if (!data) return null;

    // Create NoStorage or OneNoteStorage based on stored config
    let storage: IStandupStorage;
    if (data.storage?.type === "onenote" && data.storage.targetId) {
      // You'll need to inject the http client here
      throw new Error("OneNote storage restoration not implemented");
    } else {
      storage = new NoStorage();
    }

    // Reconstruct the group
    const group = new StandupGroup(
      conversationId,
      storage,
      data.tenantId,
      this,
      data.users || [],
      data.activeResponses || [],
      data.isActive || false,
      data.activeStandupActivityId || null,
      data.saveHistory || false
    );

    return this.wrapGroupData(group);
  }

  async saveGroup(group: StandupGroup): Promise<void> {
    const key = this.getStorageKey(group);
    const [
      users,
      isActive,
      activeResponses,
      activeStandupActivityId,
      saveHistory,
    ] = await Promise.all([
      group.getUsers(),
      group.isStandupActive(),
      group.getActiveResponses(),
      group.getActiveStandupActivityId(),
      group.getSaveHistory(),
    ]);

    const groupData: GroupStorageItem = {
      id: key.id,
      tenantId: key.tenantId,
      type: "group",
      users,
      isActive,
      activeResponses,
      activeStandupActivityId,
      storage: group.storage.getStorageInfo(),
      saveHistory,
    };

    await this.groupStorage.set(key.id, groupData);
  }

  private async wrapGroupData(group: StandupGroup): Promise<StandupGroup> {
    // Get the initial state to store in CosmosDB
    const [
      users,
      isActive,
      activeResponses,
      activeStandupActivityId,
      saveHistory,
    ] = await Promise.all([
      group.getUsers(),
      group.isStandupActive(),
      group.getActiveResponses(),
      group.getActiveStandupActivityId(),
      group.getSaveHistory(),
    ]);

    // Create a new group with the fetched data
    return new StandupGroup(
      group.conversationId,
      group.storage,
      group.tenantId,
      this,
      users,
      activeResponses,
      isActive,
      activeStandupActivityId,
      saveHistory
    );
  }

  async addStandupHistory(
    group: StandupGroup,
    summary: StandupSummary
  ): Promise<void> {
    const key = this.getStorageKey(group);
    const existingHistory = await this.historyStorage.get(key.id, key.tenantId);

    const history: HistoryStorageItem = existingHistory || {
      id: key.id,
      tenantId: key.tenantId,
      type: "history",
      summaries: [],
    };

    history.summaries.push(summary);
    await this.historyStorage.set(key.id, history);
  }

  async getStandupHistory(group: StandupGroup): Promise<StandupSummary[]> {
    const key = this.getStorageKey(group);
    const history = await this.historyStorage.get(key.id, key.tenantId);
    return history?.summaries || [];
  }
}
