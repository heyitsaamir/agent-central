import { IMessageActivity } from "@microsoft/spark.api";

export type Activity = IMessageActivity;

export interface TeamMember {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  members: TeamMember[];
  channelIds: string[];
  details: Record<string, string>;
  tenantId: string;
}

export interface TeamContext {
  currentTeam?: Team;
  memberTeams: Team[];
  channelId: string;
  userId: string;
  tenantId: string;
}

export type TeamCommand =
  | {
      type: "create";
      name: string;
      description: string;
      channelId: string;
      tenantId: string;
    }
  | { type: "addMember"; teamId: string; name: string }
  | { type: "joinTeam"; teamId: string; userId: string; name: string }
  | { type: "listMembers"; teamId: string }
  | { type: "addChannel"; teamId: string; channelId: string }
  | { type: "setDetail"; teamId: string; key: string; value: string }
  | { type: "getDetail"; teamId: string; key?: string }
  | { type: "list" }
  | { type: "listMyTeams"; userId: string }
  | {
      type: "askStandupAgent";
      teamDetails: Team;
      question: string;
    };

export interface Storage<T> {
  save(id: string, data: T): Promise<void>;
  get(id: string): Promise<T | null>;
  getAll(): Promise<T[]>;
  delete(id: string): Promise<boolean>;
}
