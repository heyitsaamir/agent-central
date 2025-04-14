import fs from "fs/promises";
import path from "path";
import { Storage, Team } from "./types";

export class TeamStorage implements Storage<Team> {
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), "data");
    this.initializeStorage();
  }

  private async initializeStorage() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create data directory:", error);
    }
  }

  private getTeamPath(teamId: string): string {
    return path.join(this.dataDir, `${teamId}.json`);
  }

  async save(id: string, team: Team): Promise<void> {
    const filePath = this.getTeamPath(id);
    await fs.writeFile(filePath, JSON.stringify(team, null, 2));
  }

  async get(id: string): Promise<Team | null> {
    try {
      const filePath = this.getTeamPath(id);
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data) as Team;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async getAll(): Promise<Team[]> {
    try {
      const files = await fs.readdir(this.dataDir);
      const teams: Team[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          const teamId = path.basename(file, ".json");
          const team = await this.get(teamId);
          if (team) {
            teams.push(team);
          }
        }
      }

      return teams;
    } catch (error) {
      console.error("Failed to read teams:", error);
      return [];
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const filePath = this.getTeamPath(id);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }
}
