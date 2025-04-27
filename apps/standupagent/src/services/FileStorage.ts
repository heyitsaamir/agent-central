import fs from "fs/promises";
import path from "path";
import { BaseStorageItem, IStorage } from "./CosmosStorage";

export class FileStorage<
  TKey extends string | number = string,
  TValue extends BaseStorageItem = BaseStorageItem,
> implements IStorage<TKey, TValue>
{
  private basePath: string;
  private databaseName: string;
  private containerName: string;

  constructor(
    databaseName: string,
    containerName: string,
    basePath: string = "data"
  ) {
    this.databaseName = databaseName;
    this.containerName = containerName;
    this.basePath = path.join(basePath, databaseName, containerName);
  }

  private getFilePath(key: TKey, tenantId: string): string {
    const compositeKey = `${tenantId}:${key}`;
    return path.join(this.basePath, `${compositeKey}.json`);
  }

  async get(key: TKey, tenantId: string): Promise<TValue | undefined> {
    try {
      const filePath = this.getFilePath(key, tenantId);
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data) as TValue;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  async set(key: TKey, value: TValue): Promise<void> {
    if (!value.tenantId) {
      throw new Error("tenantId is required");
    }
    const filePath = this.getFilePath(key, value.tenantId);
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
  }

  async delete(key: TKey, tenantId: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key, tenantId);
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

export class FileStorageFactory {
  private static stores = new Map<string, FileStorage<any, any>>();
  private static basePath: string = ".data";

  static setBasePath(path: string): void {
    this.basePath = path;
  }

  static async initialize(): Promise<void> {
    console.log("Making sure directory exists:", this.basePath);
    await fs.mkdir(this.basePath, { recursive: true });
  }

  static getStorage<
    TKey extends string | number = string,
    TValue extends BaseStorageItem = BaseStorageItem,
  >(databaseName: string, containerName: string): FileStorage<TKey, TValue> {
    const key = `${databaseName}:${containerName}`;

    if (!this.stores.has(key)) {
      this.stores.set(
        key,
        new FileStorage<TKey, TValue>(
          databaseName,
          containerName,
          this.basePath
        )
      );
    }

    return this.stores.get(key) as FileStorage<TKey, TValue>;
  }

  // Method to clear all file storage data (useful for testing)
  static async clearAll(): Promise<void> {
    try {
      await fs.rm(this.basePath, { recursive: true, force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    this.stores.clear();
  }

  // Method to clear a specific store
  static async clearStore(
    databaseName: string,
    containerName: string
  ): Promise<void> {
    const storePath = path.join(this.basePath, databaseName, containerName);
    try {
      await fs.rm(storePath, { recursive: true, force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    const key = `${databaseName}:${containerName}`;
    this.stores.delete(key);
  }
}
