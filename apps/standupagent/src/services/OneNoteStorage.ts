import * as http from "@microsoft/spark.common/http";
import { Result, StandupSummary } from "../models/types";
import { IStandupStorage, Page, StorageInfo } from "./Storage";

interface OneNoteServiceConfig {
  retryAttempts?: number;
  retryDelay?: number;
}

export class OneNoteStorage implements IStandupStorage {
  private retryAttempts: number;
  private retryDelay: number;

  constructor(
    private httpClient: http.Client,
    private pageId: string,
    config: OneNoteServiceConfig = {}
  ) {
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  getStorageInfo(): StorageInfo {
    return {
      type: "onenote",
      targetId: this.pageId,
    };
  }

  async getPages(): Promise<Result<Page[]>> {
    return this.withRetry<Page[]>(async () => {
      const response = await this.httpClient.get(
        "https://graph.microsoft.com/v1.0/me/onenote/pages",
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Extract relevant page info from response data
      const responseData = response.data;
      const pages = responseData.value.map((page: any) => ({
        id: page.id,
        title: page.title,
      }));

      return pages;
    });
  }

  async appendStandupSummary(summary: StandupSummary): Promise<Result<void>> {
    return this.withRetry<void>(async () => {
      const content = this.formatStandupContent(summary);
      // The request body must be in HTML "presentation" format
      const requestBody = [
        {
          target: "body",
          action: "append" as const,
          content: content,
        },
      ];

      await this.httpClient.patch(
        `https://graph.microsoft.com/v1.0/me/onenote/pages/${this.pageId}/content`,
        requestBody
      );
    });
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    attempt = 1
  ): Promise<Result<T>> {
    try {
      const result = await operation();
      return {
        type: "success",
        data: result,
        message: "Operation succeeded",
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (attempt < this.retryAttempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelay * attempt)
        );
        return this.withRetry(operation, attempt + 1);
      }

      return {
        type: "error",
        message: `Operation failed after ${attempt} attempts: ${errorMessage}`,
      };
    }
  }

  private formatStandupContent(summary: StandupSummary): string {
    const formattedDate = summary.date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const participantsList = summary.participants.map((p) => p.name).join(", ");

    const updates = summary.responses
      .map((r) => {
        const user = summary.participants.find((p) => p.id === r.userId);
        const name = user?.name || "Unknown User";
        return `
          <tr>
            <td><b>${name}</b></td>
            <td>
              <p><strong>Completed:</strong><br/>${r.completedWork
                .split("\n")
                .join("<br/>")}</p>
              <p><strong>Planned:</strong><br/>${r.plannedWork
                .split("\n")
                .join("<br/>")}</p>
            </td>
          </tr>`;
      })
      .join("");

    const parkingLot =
      summary.parkingLot && summary.parkingLot.length > 0
        ? `<div class="parking-lot" style="margin-top: 20px;">
           <h3>🚗 Parking Lot</h3>
           <ul>
             ${summary.parkingLot.map((item) => `<li>${item}</li>`).join("")}
           </ul>
         </div>`
        : "";

    return `
      <div style="border: 1px solid #ccc; padding: 15px; margin: 10px 0; border-radius: 5px;">
        <h2 style="color: #2B579A;">${formattedDate}</h2>
        <div style="margin: 10px 0;">
          <b>Participants:</b> ${participantsList}
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f3f3f3;">
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Team Member</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Update</th>
            </tr>
          </thead>
          <tbody>
            ${updates}
          </tbody>
        </table>
        ${parkingLot}
      </div>
    `;
  }
}
