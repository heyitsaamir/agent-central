import { PersistentStandupService } from "../services/PersistentStandupService";
import { IStandupStorage } from "../services/Storage";
import { Result, StandupResponse, StandupSummary, User } from "./types";

export class StandupGroup {
  private saveHistory: boolean = false;

  constructor(
    public readonly conversationId: string,
    public readonly storage: IStandupStorage,
    public readonly tenantId: string,
    private readonly persistentService: PersistentStandupService,
    private users: User[] = [],
    private activeResponses: StandupResponse[] = [],
    private isActive: boolean = false,
    private activeStandupActivityId: string | null = null,
    saveHistory: boolean = false
  ) {
    this.users = users;
    this.saveHistory = saveHistory;
  }

  async getSaveHistory(): Promise<boolean> {
    return this.saveHistory;
  }

  async setSaveHistory(value: boolean): Promise<void> {
    this.saveHistory = value;
  }

  async setActiveStandupActivityId(id: string) {
    this.activeStandupActivityId = id;
  }

  async getActiveStandupActivityId(): Promise<string | null> {
    return this.activeStandupActivityId;
  }

  async getActiveResponses(): Promise<StandupResponse[]> {
    return [...this.activeResponses];
  }

  async persistStandup(): Promise<Result<void>> {
    if (!this.isActive || this.activeResponses.length === 0) {
      return {
        type: "error",
        message: "No active standup to persist",
      };
    }

    const responses = [...this.activeResponses];
    const summary: StandupSummary = {
      date: new Date(),
      participants: [...this.users],
      responses: responses,
      parkingLot: responses
        .map((r) => r.parkingLot)
        .filter((item): item is string => !!item),
    };

    const result = await this.storage.appendStandupSummary(summary);
    // Convert the result to ensure it matches the expected return type
    return {
      type: result.type,
      message: result.message,
      data: undefined,
    };
  }

  async addUser(user: User): Promise<boolean> {
    if (this.users.find((u) => u.id === user.id)) {
      return false;
    }
    this.users.push(user);
    return true;
  }

  async removeUser(userId: string): Promise<boolean> {
    const initialLength = this.users.length;
    this.users = this.users.filter((u) => u.id !== userId);
    return this.users.length !== initialLength;
  }

  async getUsers(): Promise<User[]> {
    return [...this.users];
  }

  async startStandup(
    activityId?: string
  ): Promise<{ success: boolean; previousParkingLot?: string[] }> {
    if (this.isActive) return { success: false };

    let previousParkingLot: string[] | undefined;

    if (this.saveHistory) {
      const summaries = await this.persistentService.getStandupHistory(this);
      if (summaries.length > 0) {
        previousParkingLot = summaries[summaries.length - 1].parkingLot;
      }
    }

    this.isActive = true;
    this.activeStandupActivityId = activityId || null;

    return {
      success: true,
      previousParkingLot,
    };
  }

  async addResponse(response: StandupResponse): Promise<boolean> {
    if (!this.isActive) return false;
    if (this.activeResponses.find((r) => r.userId === response.userId)) {
      // Remove existing response
      this.activeResponses = this.activeResponses.filter(
        (r) => r.userId !== response.userId
      );
    }
    this.activeResponses.push(response);
    return true;
  }

  async addParkingLotItem(
    userId: string,
    parkingLot: string
  ): Promise<boolean> {
    const existingResponse = this.activeResponses.find(
      (r) => r.userId === userId
    );
    if (existingResponse) {
      existingResponse.parkingLot += `\n${parkingLot}`;
    } else {
      this.activeResponses.push({
        userId,
        parkingLot,
        timestamp: new Date(),
        completedWork: "",
        plannedWork: "",
      });
    }
    return true;
  }

  async closeStandup(
    toBeRestarted: boolean = false
  ): Promise<StandupResponse[]> {
    if (!this.isActive) return [];
    this.isActive = false;
    const responses = [...this.activeResponses];

    if (this.saveHistory && !toBeRestarted) {
      const summary: StandupSummary = {
        date: new Date(),
        participants: [...this.users],
        responses: responses,
        parkingLot: responses
          .map((r) => r.parkingLot)
          .filter((item): item is string => !!item),
      };
      await this.persistentService.addStandupHistory(this, summary);
    }

    if (!toBeRestarted) {
      this.activeResponses = [];
    }
    this.activeStandupActivityId = null;
    return responses;
  }

  async isStandupActive(): Promise<boolean> {
    return this.isActive;
  }

  async hasUser(userId: string): Promise<boolean> {
    return this.users.some((u) => u.id === userId);
  }
}
