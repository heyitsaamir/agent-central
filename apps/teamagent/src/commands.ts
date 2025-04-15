import { ChatPrompt } from "@microsoft/teams.ai";
import { OpenAIChatModel } from "@microsoft/teams.openai";
import { A2AClient } from "a2aclient";
import { Task, TaskSendParams } from "a2aschema";
import { v4 as uuidv4 } from "uuid";
import { TeamStorage } from "./storage";
import { Team, TeamCommand, TeamMember } from "./types";

export class TeamCommands {
  public readonly storage: TeamStorage;

  constructor() {
    this.storage = new TeamStorage();
  }

  async handleCommand(command: TeamCommand): Promise<string> {
    switch (command.type) {
      case "create": {
        if (!command.name || !command.description) {
          return "Usage: create <name> <description>";
        }

        const team: Team = {
          id: uuidv4(),
          name: command.name,
          description: command.description,
          members: [],
          channelIds: [command.channelId],
          details: {},
          tenantId: command.tenantId,
        };

        await this.storage.save(team.id, team);
        return `Team created: ${team.name} (ID: ${team.id})`;
      }

      case "addMember": {
        if (!command.teamId || !command.name) {
          return "Usage: add-member <teamId> <name>";
        }

        const team = await this.storage.get(command.teamId);
        if (!team) {
          return "Team not found";
        }

        const member: TeamMember = {
          id: uuidv4(),
          name: command.name,
        };

        team.members.push(member);
        await this.storage.save(team.id, team);
        return `Added ${member.name} to team ${team.name}`;
      }

      case "joinTeam": {
        if (!command.teamId || !command.userId || !command.name) {
          return "Missing required information for joining team";
        }

        const team = await this.storage.get(command.teamId);
        if (!team) {
          return "Team not found";
        }

        if (team.members.some((m) => m.id === command.userId)) {
          return "You are already a member of this team";
        }

        const member: TeamMember = {
          id: command.userId,
          name: command.name,
        };

        team.members.push(member);
        await this.storage.save(team.id, team);
        return `You (${member.name}) have joined team ${team.name}`;
      }

      case "listMembers": {
        if (!command.teamId) {
          return "Usage: list-members <teamId>";
        }

        const team = await this.storage.get(command.teamId);
        if (!team) {
          return "Team not found";
        }

        if (team.members.length === 0) {
          return "No members in team";
        }

        return team.members
          .map((member: TeamMember) => `- ${member.name}`)
          .join("\n");
      }

      case "addChannel": {
        if (!command.teamId || !command.channelId) {
          return "Usage: add-channel <teamId> <channelId>";
        }

        const team = await this.storage.get(command.teamId);
        if (!team) {
          return "Team not found";
        }

        if (!team.channelIds.includes(command.channelId)) {
          team.channelIds.push(command.channelId);
          await this.storage.save(team.id, team);
          return `Added channel ${command.channelId} to team ${team.name}`;
        }

        return "Channel already exists in team";
      }

      case "setDetail": {
        if (!command.teamId || !command.key || !command.value) {
          return "Usage: set-detail <teamId> <key> <value>";
        }

        const team = await this.storage.get(command.teamId);
        if (!team) {
          return "Team not found";
        }

        team.details[command.key] = command.value;
        await this.storage.save(team.id, team);
        return `Set ${command.key}=${command.value} for team ${team.name}`;
      }

      case "getDetail": {
        if (!command.teamId) {
          return "Usage: get-detail <teamId> <key>";
        }

        const team = await this.storage.get(command.teamId);
        if (!team) {
          return "Team not found";
        }

        if (!command.key) {
          return JSON.stringify(team.details, null, 2);
        }

        const value = team.details[command.key];
        if (!value) {
          return `No value found for key: ${command.key}`;
        }

        return `${command.key}=${value}`;
      }

      case "list": {
        const teams = await this.storage.getAll();
        if (teams.length === 0) {
          return "No teams found";
        }

        return teams
          .map(
            (team: Team) =>
              `${team.name} (ID: ${team.id})\n` +
              `Description: ${team.description}\n` +
              `Members: ${team.members.length}\n` +
              `Channels: ${team.channelIds.length}\n`
          )
          .join("\n");
      }

      case "listMyTeams": {
        const teams = await this.storage.getAll();
        const userTeams = teams.filter((team) =>
          team.members.some((member) => member.id === command.userId)
        );

        if (userTeams.length === 0) {
          return "You are not a member of any teams";
        }

        return userTeams
          .map(
            (team: Team) =>
              `${team.name} (ID: ${team.id})\n` +
              `Description: ${team.description}\n` +
              `Members: ${team.members.length}\n`
          )
          .join("\n");
      }

      case "askStandupAgent": {
        const client = new A2AClient("http://localhost:3000/a2a");
        const card = await client.agentCard();
        if (!card) {
          return "Standup agent not available";
        }
        const prompt = new ChatPrompt({
          instructions: `You are an agent who can message the standup agent for some questions. 
Here are the details about the team:
${JSON.stringify(command.teamDetails)}.


Take a look at the various skills the standup agent has:
${JSON.stringify(card.skills)}

Your job is to construct a question to ask the standup agent. Return the question only.
`,
          model: new OpenAIChatModel({
            apiKey: process.env.AZURE_OPENAI_API_KEY!,
            endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
            apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
            model: process.env.AZURE_OPENAI_MODEL_DEPLOYMENT_NAME!,
          }),
        });

        const question = await prompt.send(command.question);
        if (!question.content) {
          return "Failed to get a question from the standup agent";
        }
        console.log("Question to ask:", question.content);
        try {
          const taskId = Math.random().toString(36).substring(2, 15);
          const sendParams: TaskSendParams = {
            id: taskId,
            message: { role: "user", parts: [{ text: question.content }] },
            metadata: {
              tenantId: command.teamDetails.tenantId,
            },
          };
          // Method now returns Task | null directly
          const taskResult: Task | null = await client.sendTask(sendParams);
          console.log("Send Task Result:", taskResult);
          if (taskResult?.status.state === "completed") {
            console.log("Task completed:", taskResult);
            return (
              taskResult.artifacts
                ?.flatMap((a) => a.parts)
                ?.map((p) => {
                  if ("text" in p) {
                    return p.text;
                  } else if ("data" in p) {
                    return JSON.stringify(p.data);
                  } else if ("file" in p) {
                    // TODO
                    return "Content was returned as a file, but not readable";
                  }
                })
                .join("\n") ?? "Task completed"
            );
          } else {
            console.log("Task not completed:", taskResult);
          }
        } catch (e) {
          console.error("A2A Client Error:", e);
          return `There was an error getting parking lot items from the standup agent: ${e}`;
        }
      }
    }
    return "Unknown command";
  }
}
