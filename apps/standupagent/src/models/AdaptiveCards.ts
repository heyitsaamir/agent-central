import {
  Card,
  Element,
  ExecuteAction,
  ICard,
  ITextBlock,
  SubmitAction,
  TaskFetchAction,
  TaskFetchData,
  ToggleInput,
} from "@microsoft/teams.cards";
import { StandupResponse, User } from "./types";

export const SPECIAL_STRINGS = {
  fromPreviousParkingLot: "(from previous parking lot)",
  addedByPrefix: "(added by",
};

const convertTextToMarkdownList = (text: string, userName?: string): string => {
  return text
    .trim()
    .split("\n")
    .map((item) => item.trim())
    .map((item) => {
      // Remove any leading hyphens or asterisks even
      const cleanedItem = item.replace(/^[\-\*]\s*/, "");
      return cleanedItem;
    })
    .map((item) => {
      if (userName == null || item.includes(SPECIAL_STRINGS.addedByPrefix)) {
        return `- ${item}`;
      }

      return `- ${item} (added by ${userName})`;
    })
    .join("\n");
};

export function createStandupSummaryCard(
  responses: Array<{
    userName: string;
    completedWork: string;
    plannedWork: string;
    parkingLot?: string;
  }>
): ICard {
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const parkingLotItems = responses
    .filter((r) => r.parkingLot && r.parkingLot.trim() !== "")
    .map((r) =>
      convertTextToMarkdownList(r.parkingLot || "", r.userName).trim()
    )
    .join("\n");

  const card: ICard = {
    type: "AdaptiveCard",
    $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock" as const,
                text: "**Standup**",
                wrap: true,
                style: "heading",
              },
            ],
          },
          {
            type: "Column",
            width: "auto",
            items: [
              {
                type: "TextBlock" as const,
                text: date,
                wrap: true,
              },
            ],
          },
        ],
      },
      ...responses.flatMap((response): Element[] => [
        {
          type: "TextBlock" as const,
          text: `**${response.userName}**`,
          wrap: true,
          separator: true,
        },
        {
          type: "Table",
          columns: [
            {
              type: "Column" as const,
              width: 2,
            },
            {
              type: "Column",
              width: 6,
            },
          ],
          rows: [
            {
              type: "TableRow" as const,
              cells: [
                {
                  type: "TableCell" as const,
                  items: [
                    {
                      type: "TextBlock" as const,
                      text: "Yesterday",
                      wrap: true,
                    },
                  ],
                },
                {
                  type: "TableCell" as const,
                  items: [
                    {
                      type: "TextBlock" as const,
                      text: convertTextToMarkdownList(response.completedWork),
                      wrap: true,
                      weight: "Lighter",
                    },
                  ],
                },
              ],
            },
            {
              type: "TableRow" as const,
              cells: [
                {
                  type: "TableCell" as const,
                  items: [
                    {
                      type: "TextBlock" as const,
                      text: "Today",
                      wrap: true,
                      style: "columnHeader",
                      weight: "Bolder",
                    },
                  ],
                },
                {
                  type: "TableCell" as const,
                  items: [
                    {
                      type: "TextBlock" as const,
                      text: convertTextToMarkdownList(response.plannedWork),
                      wrap: true,
                      weight: "Lighter",
                    },
                  ],
                },
              ],
            },
          ],
        } as any,
      ]),
      ...(parkingLotItems.length > 0
        ? [
            {
              type: "TextBlock" as const,
              text: "Parking Lot",
              wrap: true,
              style: "heading",
              separator: true,
            } satisfies ITextBlock,
            {
              type: "TextBlock" as const,
              text: parkingLotItems,
              wrap: true,
            } satisfies ITextBlock,
          ]
        : []),
    ],
  };

  return card;
}

export function createStandupCard(
  completedResponses: string[] = [],
  previousParkingLot?: string[]
): ICard {
  const previousParkingLotItems = previousParkingLot
    ?.flatMap((p) => p.split("\n").map((p) => p.trim()))
    ?.filter((p) => p.trim() !== "")
    .map((p) => convertTextToMarkdownList(p));
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "TextBlock" as const,
        text: "Standup Session",
        size: "large",
        weight: "bolder",
      },
      {
        type: "TextBlock" as const,
        text: "Enter your details by clicking the button below.",
        wrap: true,
      },
      ...(completedResponses.length > 0
        ? [
            {
              type: "TextBlock" as const,
              text: `Completed responses: ${completedResponses.join(", ")}`,
              wrap: true,
              spacing: "medium" as const,
            },
          ]
        : []),
      ...(previousParkingLotItems && previousParkingLotItems.length > 0
        ? [
            {
              type: "TextBlock" as const,
              text: "Discussed Previous Parking Lot Items:",
              wrap: true,
              spacing: "medium" as const,
            },
            {
              type: "TextBlock" as const,
              text: "Uncheck the values that still need discussion",
              wrap: true,
              size: "small" as const,
              weight: "lighter",
              isSubtle: true,
              spacing: "none" as const,
            } satisfies ITextBlock,
            ...previousParkingLotItems.map(
              (item, index) =>
                new ToggleInput(item, {
                  id: `parking_lot_${index}`,
                  value: `Discussed - ${item}`,
                  valueOff: `Not Discussed - ${item}`,
                  valueOn: `Discussed - ${item}`,
                  wrap: true,
                  spacing: "none" as const,
                })
            ),
          ]
        : []),
      {
        type: "ActionSet",
        actions: [
          new TaskFetchAction({})
            .withTitle("Fill out your status")
            .withData(new TaskFetchData("standup_input"))
            .withStyle("positive"),
          new ExecuteAction({
            title: "Close standup",
          })
            .withStyle("default")
            .withData({
              action: "close_standup",
              previousParkingLot: JSON.stringify(previousParkingLotItems),
            }),
        ],
      },
    ],
  };
}

export function createPageSelectionCard(
  pages: { id: string; title: string }[],
  sourceConversationId: string
): ICard {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "TextBlock" as const,
        text: "Select OneNote Page for Standup",
        size: "large",
        weight: "bolder",
      },
      {
        type: "TextBlock" as const,
        text: "Choose a page to store your standup notes:",
        wrap: true,
      },
      {
        type: "Input.ChoiceSet",
        id: "pageId",
        style: "expanded",
        isRequired: true,
        choices: pages.map((page) => ({
          title: page.title,
          value: page.id,
        })),
      },
      {
        type: "ActionSet",
        actions: [
          new ExecuteAction({
            title: "Register",
          }).withData({
            action: "register_standup",
            sourceConversationId: sourceConversationId,
          }),
        ],
      },
    ],
  };
}

export function createParkingLotCard(
  items: Array<{ item: string; userName: string }>
): ICard {
  return new Card().withBody(
    {
      type: "ColumnSet",
      columns: [
        {
          type: "Column",
          width: "stretch",
          items: [
            {
              type: "TextBlock" as const,
              text: "**Current Parking Lot Items**",
              wrap: true,
              style: "heading",
            },
          ],
        },
      ],
    },
    ...(items.length === 0
      ? [
          {
            type: "TextBlock" as const,
            text: "_No parking lot items have been added yet._",
            wrap: true,
            isSubtle: true,
          },
        ]
      : items.map(({ item, userName }) => {
          let itemText: string;
          if (item.includes(SPECIAL_STRINGS.addedByPrefix)) {
            itemText = `- ${item}`;
          }

          itemText = `- ${item} (added by ${userName})`;

          return {
            type: "TextBlock" as const,
            text: itemText,
            wrap: true,
            spacing: "small" as const,
          };
        }))
  );
}

export function createTaskModule(
  user: User,
  existingResponse?: StandupResponse
): ICard {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "TextBlock" as const,
        text: `${user.name}'s Standup Update`,
        size: "large",
        weight: "bolder",
      },
      {
        type: "TextBlock" as const,
        text: "What did you do since last standup?",
        wrap: true,
      },
      {
        type: "Input.Text",
        id: "completedWork",
        placeholder: "Enter your completed tasks and progress...",
        isMultiline: true,
        isRequired: true,
        style: "text",
        value: existingResponse?.completedWork,
      },
      {
        type: "TextBlock" as const,
        text: "What do you plan to do today?",
        wrap: true,
      },
      {
        type: "Input.Text",
        id: "plannedWork",
        placeholder: "Enter your planned tasks for today...",
        isMultiline: true,
        isRequired: true,
        style: "text",
        value: existingResponse?.plannedWork,
      },
      {
        type: "TextBlock" as const,
        text: "Parking Lot",
        wrap: true,
      },
      {
        type: "Input.Text",
        id: "parkingLot",
        placeholder: "Anything you want to discuss as a team?",
        isMultiline: true,
        style: "text",
        value: existingResponse?.parkingLot,
      },
      {
        type: "ActionSet",
        actions: [
          new SubmitAction({
            title: "Submit",
          }).withData({
            action: "submit_standup",
            userId: user.id,
          }),
        ],
      },
    ],
  };
}

export function createHistoricalStandupsCard(
  histories: Array<{
    date: Date;
    groupName?: string;
    responses: Array<{
      userName: string;
      completedWork: string;
      plannedWork: string;
      parkingLot?: string;
    }>;
  }>
): ICard {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "TextBlock" as const,
        text: "Historical Standups",
        size: "large",
        weight: "bolder",
      },
      ...histories.flatMap((history) => [
        {
          type: "Container" as const,
          items: [
            {
              type: "TextBlock" as const,
              text: history.date.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              }),
              wrap: true,
              style: "heading" as const,
            },
            ...(history.groupName
              ? [
                  {
                    type: "TextBlock" as const,
                    text: `Group: ${history.groupName}`,
                    wrap: true,
                    size: "small" as const,
                  },
                ]
              : []),
          ],
        },
        ...history.responses
          .filter((r) => r.completedWork || r.plannedWork)
          .flatMap((response): Element[] => [
            {
              type: "TextBlock" as const,
              text: `**${response.userName}**`,
              wrap: true,
              separator: true,
            },
            {
              type: "Table",
              columns: [
                {
                  type: "Column",
                  width: 2,
                },
                {
                  type: "Column",
                  width: 6,
                },
              ],
              rows: [
                {
                  type: "TableRow" as const,
                  cells: [
                    {
                      type: "TableCell" as const,
                      items: [
                        {
                          type: "TextBlock" as const,
                          text: "Completed",
                          wrap: true,
                        },
                      ],
                    },
                    {
                      type: "TableCell" as const,
                      items: [
                        {
                          type: "TextBlock" as const,
                          text: convertTextToMarkdownList(
                            response.completedWork
                          ),
                          wrap: true,
                          weight: "Lighter",
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "TableRow" as const,
                  cells: [
                    {
                      type: "TableCell" as const,
                      items: [
                        {
                          type: "TextBlock" as const,
                          text: "Planned",
                          wrap: true,
                        },
                      ],
                    },
                    {
                      type: "TableCell" as const,
                      items: [
                        {
                          type: "TextBlock" as const,
                          text: convertTextToMarkdownList(response.plannedWork),
                          wrap: true,
                          weight: "Lighter",
                        },
                      ],
                    },
                  ],
                },
              ],
            } as any,
            // Skipping parking lot items for now
            // ...(response.parkingLot
            //   ? [
            //       {
            //         type: "TextBlock" as const,
            //         text: "Parking Lot Items:",
            //         wrap: true,
            //         size: "small",
            //       },
            //       {
            //         type: "TextBlock" as const,
            //         text: convertTextToMarkdownList(
            //           response.parkingLot,
            //           response.userName
            //         ),
            //         wrap: true,
            //         size: "small",
            //         weight: "lighter",
            //       },
            //     ]
            //   : []),
          ]),
      ]),
    ],
  };
}
