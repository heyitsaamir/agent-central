import {
  ConfigResponse,
  IConfigFetchInvokeActivity,
  IConfigSubmitInvokeActivity,
  cardAttachment,
} from "@microsoft/spark.api";
import { createConfigCard } from "./cards";
import { FileConfigStorage } from "./storage";
import { SupportConfig } from "./types";

export class ConfigHandler {
  private storage: FileConfigStorage;

  constructor() {
    this.storage = new FileConfigStorage();
  }

  async handleOpen(
    activity: IConfigFetchInvokeActivity
  ): Promise<ConfigResponse> {
    const conversationId = activity.conversation.id;
    const existingConfig = await this.storage.get(conversationId);

    return {
      responseType: "config",
      config: {
        type: "continue",
        value: {
          title: "Support Agent Configuration",
          card: cardAttachment(
            "adaptive",
            createConfigCard(existingConfig || undefined, conversationId)
          ),
        },
      } as any,
    };
  }

  async handleSubmit(
    activity: IConfigSubmitInvokeActivity
  ): Promise<ConfigResponse> {
    const conversationId = activity.conversation.id;
    const data = activity.value.data ?? {};

    // Parse and validate config data
    const config: SupportConfig = {
      githubRepo: data.githubRepo?.trim() || "",
      githubToken: data.githubToken?.trim() || "",
      labels: data.labels
        ? data.labels
            .split(",")
            .map((label: string) => label.trim())
            .filter(Boolean)
        : [],
      autoCreateIssues: data.autoCreateIssues === "true",
    };

    // Validate required fields
    if (!config.githubRepo || !config.githubToken) {
      return {
        responseType: "config",
        config: {
          task: {
            type: "message",
            value: "GitHub repository and token are required.",
          },
        },
      };
    }

    // Save the configuration
    try {
      await this.storage.save(conversationId, config);

      return {
        responseType: "config",
        config: {
          task: {
            type: "message",
            value: "Configuration saved successfully.",
          },
        },
      };
    } catch (error) {
      console.error("Error saving configuration:", error);
      return {
        responseType: "config",
        config: {
          task: {
            type: "message",
            value: "Failed to save configuration. Please try again.",
          },
        },
      };
    }
  }
}
