import { Result, StandupSummary } from "../models/types";

export interface Page {
  id: string;
  title: string;
}

export interface StorageInfo {
  type: "onenote" | "none" | string;
  targetId?: string;
}

export interface IStandupStorage {
  getPages(): Promise<Result<Page[]>>;
  appendStandupSummary(summary: StandupSummary): Promise<Result<void>>;
  getStorageInfo(): StorageInfo;
}

// No-op implementation for when persistence is not needed
export class NoStorage implements IStandupStorage {
  async getPages(): Promise<Result<Page[]>> {
    return {
      type: "success",
      data: [],
      message: "No pages available",
    };
  }

  async appendStandupSummary(summary: StandupSummary): Promise<Result<void>> {
    return {
      type: "success",
      data: undefined,
      message: "Operation skipped (no storage configured)",
    };
  }

  getStorageInfo(): StorageInfo {
    return {
      type: "none",
    };
  }
}
