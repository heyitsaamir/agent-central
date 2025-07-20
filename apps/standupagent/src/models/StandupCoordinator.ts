import { IAdaptiveCard } from "@microsoft/teams.cards";
import { StandupGroupService } from "../services/StandupGroupService";
import { IStandupStorage } from "../services/Storage";
import { UserStandupService } from "../services/UserStandupService";
import { StandupGroup } from "./StandupGroup";
import { Result, StandupResponse, User } from "./types";

/**
 * Coordinator class that delegates operations to specialized services.
 * Coordinates between StandupGroupService and UserStandupService to provide
 * a unified interface for both group standup management and individual user operations.
 */
export class StandupCoordinator {
  private groupService: StandupGroupService;
  private userService: UserStandupService;

  constructor() {
    this.groupService = new StandupGroupService();
    this.userService = new UserStandupService();
  }

  async initialize(cosmosConnectionString: string): Promise<void> {
    await this.groupService.initialize(cosmosConnectionString);
    await this.userService.initialize(cosmosConnectionString, this.groupService);
  }

  // === GROUP STANDUP OPERATIONS ===
  // These methods delegate to StandupGroupService

  async registerGroup(
    conversationId: string,
    storage: IStandupStorage,
    creator: User,
    tenantId: string,
    includeHistory: boolean = true
  ): Promise<Result<{ message: string }>> {
    return await this.groupService.registerGroup(conversationId, storage, creator, tenantId, includeHistory);
  }

  async addUsers(
    conversationId: string,
    users: User[],
    tenantId: string
  ): Promise<Result<{ message: string }>> {
    return await this.groupService.addUsers(conversationId, users, tenantId);
  }

  async removeUsers(
    conversationId: string,
    userIds: string[],
    tenantId: string
  ): Promise<Result<{ message: string }>> {
    return await this.groupService.removeUsers(conversationId, userIds, tenantId);
  }

  async startStandup(
    conversationId: string,
    tenantId: string,
    activityId?: string
  ): Promise<Result<{ message: string; previousParkingLot?: string[] }>> {
    return await this.groupService.startStandup(conversationId, tenantId, activityId);
  }

  async submitResponse(
    conversationId: string,
    response: StandupResponse,
    tenantId: string,
    send?: (activity: any) => Promise<any>
  ): Promise<Result<{ message: string }>> {
    return await this.groupService.submitResponse(conversationId, response, tenantId, send);
  }

  async closeStandup(
    conversationId: string,
    tenantId: string,
    send: (activity: any) => Promise<any>,
    toBeRestarted: boolean = false,
  ): Promise<Result<{ message: string; summary?: IAdaptiveCard }>> {
    return await this.groupService.closeStandup(conversationId, tenantId, send, toBeRestarted,);
  }

  async validateGroup(
    conversationId: string,
    tenantId: string
  ): Promise<StandupGroup | null> {
    return await this.groupService.validateGroup(conversationId, tenantId);
  }

  async getParkingLotItems(
    conversationId: string,
    tenantId: string
  ): Promise<Result<{ parkingLotItems: Array<{ item: string; userName: string | null }> }>> {
    return await this.groupService.getParkingLotItems(conversationId, tenantId);
  }

  async clearParkingLot(
    conversationId: string,
    tenantId: string,
    userId: string | null,
  ): Promise<Result<{ message: string }>> {
    return await this.groupService.clearParkingLot(conversationId, tenantId, userId);
  }

  async getGroupDetails(
    conversationId: string,
    tenantId: string
  ): Promise<Result<{ members: User[]; startedAt: string | null; storageType: string }>> {
    return await this.groupService.getGroupDetails(conversationId, tenantId);
  }

  // === USER STANDUP OPERATIONS ===
  // These methods delegate to UserStandupService

  async getUserSettings(userId: string, tenantId: string): Promise<Result<{ settings: any }>> {
    return await this.userService.getUserSettings(userId, tenantId);
  }

  async setDefaultStandup(userId: string, tenantId: string, standupGroupId: string): Promise<Result<{ message: string }>> {
    return await this.userService.setDefaultStandup(userId, tenantId, standupGroupId);
  }



  async getStandupsForUser(userId: string, tenantId: string): Promise<Result<{ standups: Array<{ conversationId: string; isDefault: boolean }> }>> {
    return await this.userService.getStandupsForUser(userId, tenantId);
  }

  // === WORK ITEM OPERATIONS ===
  // These methods add work items to the user's default group

  async addWorkItemToDefaultGroup(userId: string, tenantId: string, workItem: string): Promise<Result<{ message: string }>> {
    try {
      // Get user's settings and standup groups
      const userStandupsResult = await this.userService.getStandupsForUser(userId, tenantId);
      if (userStandupsResult.type === "error") {
        return userStandupsResult;
      }

      const targetStandup = userStandupsResult.data.standups.find(s => s.isDefault);

      if (!targetStandup) {
        if (!userStandupsResult.data.standups || userStandupsResult.data.standups.length === 0) {
          return {
            type: "error",
            message: "You are not a member of any standup groups yet. Join a standup group first."
          };
        } else {
          return {
            type: "error",
            message: "You belong to multiple standup groups. Use 'set default standup' to choose your default group."
          };
        }
      }

      // Validate the group exists and user has access
      const group = await this.validateGroup(targetStandup.conversationId, tenantId);
      if (!group) {
        return {
          type: "error",
          message: "Your standup group no longer exists or you don't have access to it."
        };
      }

      // Check if user is a member of the group
      const hasAccess = await group.hasUser(userId);
      if (!hasAccess) {
        return {
          type: "error",
          message: "You are not a member of your standup group."
        };
      }

      // Add the work item to the group
      await group.addWorkItem(userId, workItem);

      return {
        type: "success",
        data: { message: `Work item added to your standup group (${targetStandup.conversationId})` },
        message: `Work item added to your standup group (${targetStandup.conversationId})`
      };
    } catch (error) {
      return {
        type: "error",
        message: `Failed to add work item: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getWorkItemsFromDefaultGroup(userId: string, tenantId: string): Promise<Result<{ workItems: string[]; groupId: string }>> {
    try {
      // Get user's settings and standup groups
      const userStandupsResult = await this.userService.getStandupsForUser(userId, tenantId);
      if (userStandupsResult.type === "error") {
        return userStandupsResult;
      }

      const targetStandup = userStandupsResult.data.standups.find(s => s.isDefault);
      let targetGroupId = targetStandup?.conversationId;

      if (!targetGroupId) {
        if (!userStandupsResult.data.standups || userStandupsResult.data.standups.length === 0) {
          return {
            type: "error",
            message: "You are not a member of any standup groups yet."
          };
        } else {
          return {
            type: "error",
            message: "You belong to multiple standup groups. Use 'set default standup' to choose your default group."
          };
        }
      }

      // Get the group
      const group = await this.validateGroup(targetGroupId, tenantId);
      if (!group) {
        return {
          type: "error",
          message: "Your default standup group no longer exists."
        };
      }

      // Get user's active responses
      const activeResponses = await group.getActiveResponses();
      const userResponse = activeResponses.find(r => r.userId === userId);

      const workItems = userResponse?.plannedWork
        ? userResponse.plannedWork.split('\n').filter(item => item.trim())
        : [];

      return {
        type: "success",
        data: {
          workItems,
          groupId: targetGroupId
        },
        message: "Work items retrieved successfully"
      };
    } catch (error) {
      return {
        type: "error",
        message: `Failed to get work items: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async clearWorkItemsFromDefaultGroup(userId: string, tenantId: string): Promise<Result<{ message: string }>> {
    try {
      // Get user's settings and standup groups
      const userStandupsResult = await this.userService.getStandupsForUser(userId, tenantId);
      if (userStandupsResult.type === "error") {
        return userStandupsResult;
      }

      const targetStandup = userStandupsResult.data.standups.find(s => s.isDefault);
      let targetGroupId = targetStandup?.conversationId;

      if (!targetGroupId) {
        if (!userStandupsResult.data.standups || userStandupsResult.data.standups.length === 0) {
          return {
            type: "error",
            message: "You are not a member of any standup groups yet."
          };
        } else {
          return {
            type: "error",
            message: "You belong to multiple standup groups. Use 'set default standup' to choose your default group."
          };
        }
      }

      // Get the group
      const group = await this.validateGroup(targetGroupId, tenantId);
      if (!group) {
        return {
          type: "error",
          message: "Your default standup group no longer exists."
        };
      }

      // Clear user's planned work
      const activeResponses = await group.getActiveResponses();
      const userResponse = activeResponses.find(r => r.userId === userId);

      if (userResponse) {
        userResponse.plannedWork = "";
      }

      return {
        type: "success",
        data: { message: `Work items cleared from your standup group (${targetGroupId})` },
        message: `Work items cleared from your standup group (${targetGroupId})`
      };
    } catch (error) {
      return {
        type: "error",
        message: `Failed to clear work items: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // === CROSS-SERVICE OPERATIONS ===
  // These methods coordinate between both services

  async getHistoricalStandups(options: {
    conversationId: string;
    tenantId: string;
  } | {
    userId: string;
    tenantId: string;
  }
  ): Promise<
    Result<{
      histories: Array<{
        date: Date;
        groupName?: string;
        responses: Array<{
          userName: string;
          completedWork: string;
          plannedWork: string;
          parkingLot?: string;
        }>;
      }>;
    }>
  > {
    if ('conversationId' in options) {
      // For group history, use the group service
      return await this.groupService.getGroupHistoricalStandups(options.conversationId, options.tenantId);
    } else {
      // For personal history, use the user service
      return await this.userService.getPersonalHistoricalStandups(options.userId, options.tenantId);
    }
  }
}

export default StandupCoordinator;
