import { Octokit } from "octokit";
import { Issue, SearchCriteria } from "./types";

export class GitHubClient {
  private client: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, repository: string) {
    this.client = new Octokit({ auth: token });
    [this.owner, this.repo] = repository.split("/");
  }

  async searchIssues(criteria: SearchCriteria): Promise<Issue[]> {
    let query = `repo:${this.owner}/${this.repo}`;

    query += ` is:issue`;

    if (criteria.text) {
      query += ` ${criteria.text} in:title,body`;
    }

    if (criteria.state) {
      query += ` state:${criteria.state}`;
    }

    if (criteria.labels?.length) {
      criteria.labels.forEach((label) => {
        query += ` label:"${label}"`;
      });
    }

    if (criteria.priority) {
      query += ` label:${criteria.priority}`;
    }

    if (criteria.assignee) {
      query += ` assignee:${criteria.assignee}`;
    }

    const response = await this.client.request("GET /search/issues", {
      q: query,
      per_page: 10,
      sort: "updated",
      order: "desc",
    });

    return response.data.items.map((item: any) => ({
      number: item.number,
      title: item.title,
      body: item.body || "",
      state: item.state as "open" | "closed",
      labels:
        item.labels
          ?.map((label: any) =>
            typeof label === "string" ? label : label.name
          )
          .filter((label: unknown): label is string => !!label) || [],
      created_at: item.created_at,
      updated_at: item.updated_at,
      html_url: item.html_url,
    }));
  }

  async createIssue(
    title: string,
    body: string,
    labels?: string[]
  ): Promise<Issue> {
    const response = await this.client.rest.issues.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      labels,
    });

    const issue = response.data;
    return {
      number: issue.number,
      title: issue.title,
      body: issue.body || "",
      state: issue.state as "open" | "closed",
      labels:
        issue.labels
          ?.map((label: any) =>
            typeof label === "string" ? label : label.name
          )
          .filter((label: unknown): label is string => !!label) || [],
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      html_url: issue.html_url,
    };
  }
}
