import { GitHubClient } from "./client";
import { SupportConfig } from "./config/types";
import { Issue, SupportCommand } from "./types";

export class SupportCommands {
  private githubClient: GitHubClient;

  constructor(config: SupportConfig) {
    this.githubClient = new GitHubClient(config.githubToken, config.githubRepo);
  }

  async handleCommand(command: SupportCommand): Promise<string> {
    switch (command.type) {
      case "searchIssues": {
        try {
          const issues = await this.githubClient.searchIssues({
            text: command.query,
            priority: command.priority,
          });

          if (issues.length === 0) {
            return "No matching issues found.";
          }

          return this.formatIssueList(issues);
        } catch (error) {
          console.error("Error searching issues:", error);
          return "Failed to search issues. Please try again.";
        }
      }

      case "createIssue": {
        try {
          const issue = await this.githubClient.createIssue(
            command.title,
            command.body,
            command.labels || []
          );

          return `Created new issue #${issue.number}: ${issue.title}\n${issue.html_url}`;
        } catch (error) {
          console.error("Error creating issue:", error);
          return "Failed to create issue. Please try again.";
        }
      }

      default: {
        return "Unknown command";
      }
    }
  }

  private formatIssueList(issues: Issue[]): string {
    return issues
      .map(
        (issue) =>
          `#${issue.number}: ${issue.title}\n` +
          `Status: ${issue.state}\n` +
          `Labels: ${issue.labels.join(", ") || "none"}\n` +
          `Link: ${issue.html_url}\n`
      )
      .join("\n");
  }
}
