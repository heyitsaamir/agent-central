import { IMemory } from "@microsoft/spark.ai";
import { Message } from "@microsoft/spark.ai/dist/message.js";
import fs from "fs/promises";
import path from "path";

type StoredMessage = Message & {
  id: number;
  timestamp: number;
};

export interface MemoryConfig {
  type: "time" | "count";
  value: number; // minutes for time, message count for count
}

export class FileListStorage implements IMemory {
  private items: StoredMessage[] = [];
  private filePath: string;
  private initialized: boolean = false;
  private nextId: number = 0;
  private config?: MemoryConfig;

  constructor(conversationId: string, config?: MemoryConfig) {
    this.filePath = path.join(
      process.cwd(),
      "data/conversations",
      `${conversationId}.json`
    );
    this.config = config;
  }

  private async initialize() {
    if (this.initialized) return;

    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const data = await fs.readFile(this.filePath, "utf8");
      this.items = JSON.parse(data);
      // Find highest ID to continue sequence
      this.nextId = Math.max(...this.items.map((m) => m.id), 0) + 1;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Error initializing conversation storage:", error);
      }
      this.items = [];
      this.nextId = 0;
    }
    this.initialized = true;
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(this.items, null, 2));
  }

  async get(id: number): Promise<Message | undefined> {
    await this.initialize();
    const message = this.items.find((msg) => msg.id === id);
    if (!message) return undefined;
    const { id: _id, timestamp: _ts, ...messageData } = message;
    return messageData;
  }

  async set(id: number, value: Message): Promise<void> {
    await this.initialize();
    const index = this.items.findIndex((msg) => msg.id === id);
    if (index !== -1) {
      this.items[index] = {
        ...value,
        id,
        timestamp: Date.now(),
      };
      await this.persist();
    }
  }

  async delete(id: number): Promise<void> {
    await this.initialize();
    const index = this.items.findIndex((msg) => msg.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
      await this.persist();
    }
  }

  async push(value: Message): Promise<void> {
    await this.initialize();
    this.items.push({
      ...value,
      id: this.nextId++,
      timestamp: Date.now(),
    });
    await this.persist();
  }

  async pop(): Promise<Message | undefined> {
    await this.initialize();
    if (this.items.length === 0) return undefined;

    const messages = [...this.items].sort((a, b) => b.timestamp - a.timestamp);
    const latest = messages[0];
    await this.delete(latest.id);
    const { id: _id, timestamp: _ts, ...messageData } = latest;
    return messageData;
  }

  private getFilteredItems(): StoredMessage[] {
    if (!this.config) return this.items;

    if (this.config.type === "time") {
      const cutoffTime = Date.now() - this.config.value * 60 * 1000;
      return this.items.filter((msg) => msg.timestamp >= cutoffTime);
    } else {
      return [...this.items]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.config.value);
    }
  }

  async values(): Promise<Array<Message>> {
    await this.initialize();
    return this.getFilteredItems().map(
      ({ id: _id, timestamp: _ts, ...msg }) => msg
    );
  }

  async length(): Promise<number> {
    await this.initialize();
    return this.getFilteredItems().length;
  }

  where(predicate: (value: Message, index: number) => boolean): Array<Message> {
    return this.getFilteredItems()
      .map(({ id: _id, timestamp: _ts, ...msg }) => msg)
      .filter(predicate);
  }

  async clear(): Promise<void> {
    this.items = [];
    await this.persist();
  }

  async collapse(): Promise<Message | undefined> {
    await this.initialize();
    if (this.items.length === 0) return undefined;

    // Combine filtered messages into a single system message
    const filteredItems = this.getFilteredItems();
    const combinedContent = filteredItems
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const collapsedMessage: StoredMessage = {
      id: this.nextId++,
      timestamp: Date.now(),
      role: "system",
      content: combinedContent,
    };

    // Replace all messages with the collapsed one
    this.items = [collapsedMessage];
    await this.persist();

    const { id: _id, timestamp: _ts, ...messageData } = collapsedMessage;
    return messageData;
  }
}
