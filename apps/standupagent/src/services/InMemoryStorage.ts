import { BaseStorageItem, IStorage } from "./MongoStorage";

export class InMemoryStorage<
  TKey extends string | number = string,
  TValue extends BaseStorageItem = BaseStorageItem
> implements IStorage<TKey, TValue>
{
  private store: Map<string, TValue> = new Map();

  private getCompositeKey(key: TKey, tenantId: string): string {
    return `${tenantId}:${key}`;
  }

  async get(key: TKey, tenantId: string): Promise<TValue | undefined> {
    return this.store.get(this.getCompositeKey(key, tenantId));
  }

  async set(key: TKey, value: TValue): Promise<void> {
    if (!value.tenantId) {
      throw new Error("tenantId is required");
    }
    this.store.set(this.getCompositeKey(key, value.tenantId), value);
  }

  async delete(key: TKey, tenantId: string): Promise<void> {
    this.store.delete(this.getCompositeKey(key, tenantId));
  }
}

export class InMemoryStorageFactory {
  private static stores = new Map<string, InMemoryStorage<any, any>>();

  static getStorage<
    TKey extends string | number = string,
    TValue extends BaseStorageItem = BaseStorageItem
  >(
    databaseName: string,
    containerName: string
  ): InMemoryStorage<TKey, TValue> {
    const key = `${databaseName}:${containerName}`;

    if (!this.stores.has(key)) {
      this.stores.set(key, new InMemoryStorage<TKey, TValue>());
    }

    return this.stores.get(key) as InMemoryStorage<TKey, TValue>;
  }

  // Method to clear all in-memory data (useful for testing)
  static clearAll(): void {
    this.stores.clear();
  }

  // Method to clear a specific store
  static clearStore(databaseName: string, containerName: string): void {
    const key = `${databaseName}:${containerName}`;
    this.stores.delete(key);
  }
}
