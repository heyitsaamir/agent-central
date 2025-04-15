import { IMessageActivity } from "@microsoft/teams.api";

export type Activity = IMessageActivity;

export interface SupportResponse {
  content: string;
  data: { toolName: string; result: any }[];
}
export interface Issue {
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  labels: string[];
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface SearchCriteria {
  text?: string;
  labels?: string[];
  state?: "open" | "closed";
  priority?: "low priority" | "high priority";
  assignee?: string;
}

export type SupportCommand =
  | {
      type: "searchIssues";
      query?: string;
      priority?: "low priority" | "high priority";
    }
  | {
      type: "createIssue";
      title: string;
      body: string;
      labels?: string[];
    };
