import { ICard, SubmitAction } from "@microsoft/teams.cards";
import { ConfigCardData, SupportConfig } from "./types";

export function createConfigCard(
  existingConfig?: SupportConfig,
  conversationId?: string
): ICard {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: "Support Agent Configuration",
        size: "large",
        weight: "bolder",
      },
      {
        type: "TextBlock",
        text: "Configure GitHub repository and issue settings",
        wrap: true,
      },
      {
        type: "Input.Text",
        id: "githubRepo",
        label: "GitHub Repository",
        placeholder: "owner/repository-name",
        isRequired: true,
        value: existingConfig?.githubRepo || "",
      },
      {
        type: "Input.Text",
        id: "githubToken",
        label: "GitHub Token",
        placeholder: "Personal Access Token",
        isRequired: true,
        style: "password",
        value: existingConfig?.githubToken || "",
      },
      {
        type: "Input.Text",
        id: "labels",
        label: "Default Labels",
        placeholder: "bug, enhancement, documentation (comma-separated)",
        value: existingConfig?.labels?.join(", ") || "",
      },
      {
        type: "Input.Toggle",
        id: "autoCreateIssues",
        title: "Auto-create issues",
        value: existingConfig?.autoCreateIssues ? "true" : "false",
      },
      {
        type: "ActionSet",
        actions: [
          new SubmitAction({
            title: "Save Configuration",
          }).withData({
            action: "submit_config" as const,
            conversationId: conversationId || "",
          } satisfies ConfigCardData),
        ],
      },
    ],
  };
}
