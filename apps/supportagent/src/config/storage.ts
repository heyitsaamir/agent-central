import fs from "fs/promises";
import path from "path";
import { ConfigStorage, SupportConfig } from "./types";

export class FileConfigStorage implements ConfigStorage {
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), "data", "configs");
    this.initializeStorage();
  }

  private async initializeStorage() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create config directory:", error);
    }
  }

  private getConfigPath(conversationId: string): string {
    return path.join(this.dataDir, `${conversationId}.json`);
  }

  async save(conversationId: string, config: SupportConfig): Promise<void> {
    const filePath = this.getConfigPath(conversationId);
    await fs.writeFile(filePath, JSON.stringify(config, null, 2));
  }

  async get(conversationId: string): Promise<SupportConfig | null> {
    try {
      const filePath = this.getConfigPath(conversationId);
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data) as SupportConfig;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }
}
