import { IStorage } from "@microsoft/teams.common";
import fs from "fs/promises";
import path from "path";

export class FileStorage<
    TKey extends string | number = string,
    TValue extends {} = {},
> implements IStorage<TKey, TValue> {
    private basePath: string;

    constructor(
        basePath: string = "data"
    ) {
        this.basePath = path.join(basePath);
    }

    private async getOrCreateFilePath(key: TKey): Promise<string> {
        const compositeKey = key;
        const filePath = path.join(this.basePath, `${compositeKey}.json`);

        console.log("File path:", filePath);
        try {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
                throw error;
            }
        }

        return filePath;
    }

    async get(key: TKey): Promise<TValue | undefined> {
        try {
            const filePath = await this.getOrCreateFilePath(key);
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
        const filePath = await this.getOrCreateFilePath(key);
        await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
    }

    async delete(key: TKey): Promise<void> {
        try {
            const filePath = await this.getOrCreateFilePath(key);
            await fs.unlink(filePath);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                throw error;
            }
        }
    }
}