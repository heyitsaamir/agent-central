# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Running
- `npm run build` - Compile TypeScript to JavaScript in dist/ folder
- `npm run dev` - Start development server with hot reload using nodemon
- `npm run start` - Run the built application from dist/
- `npm run clean` - Remove the dist/ directory

### Environment-Specific Development
- `npm run dev:teamsfx` - Run with Teams Toolkit environment variables
- `npm run dev:teamsfx:testtool` - Run for Teams App Test Tool
- `npm run dev:teamsfx:launch-testtool` - Launch Teams App Test Tool

### Deployment
- `./buildAndDeploy.sh` - Build Docker image and deploy to Azure Container Registry and Web App

## Architecture Overview

This is a **Microsoft Teams bot application** that manages standup meetings. It's built using the Microsoft Teams Apps SDK v2.0 preview.

### Core Components

1. **StandupCoordinator** (`src/models/StandupCoordinator.ts`) - Main orchestrator that delegates to specialized services
   - Coordinates between StandupGroupService and UserStandupService
   - Provides unified interface for group and individual user operations

2. **Services Layer** (`src/services/`)
   - `StandupGroupService` - Manages group standup operations
   - `UserStandupService` - Handles individual user settings and operations
   - `StandupGroupManager` - Uses proxy pattern to auto-persist state changes
   - Multiple storage implementations: Cosmos DB, File, In-Memory

3. **Event Handlers** (`src/handlers/`)
   - `message.ts` - Processes incoming chat messages
   - `dialog.ts` - Handles modal dialog interactions
   - `cardActions.ts` - Processes adaptive card button clicks

4. **Commands** (`src/commands/`)
   - `standup.ts` - Start/manage standup sessions
   - `register.ts` - Register new standup groups
   - `users.ts` - Add/remove users from groups

### Key Patterns

- **Proxy Pattern**: StandupGroupManager wraps StandupGroup with auto-persistence
- **Service Delegation**: StandupCoordinator delegates to specialized services rather than handling operations directly
- **Adaptive Cards**: UI interactions through Microsoft Teams adaptive cards
- **Agent-to-Agent (A2A)**: Integration with other agents via A2A plugin

### Storage Architecture

The app supports multiple storage backends through the `IStandupStorage` interface:
- **Cosmos DB** - Primary production storage (via MongoDB)
- **File Storage** - Local development
- **In-Memory** - Testing

Groups are auto-persisted after state-changing operations via the proxy pattern in StandupGroupManager.

### Teams Integration

- Uses Microsoft Teams Apps SDK v2.0 preview
- Supports bot installation in teams/channels
- Handles signin/signout events
- Processes message activities and card interactions
- A2A integration for cross-agent communication

### Environment Configuration

The app expects these environment variables:
- `PORT` - Server port (default: 3000)
- `WEBSITE_HOSTNAME` - Hostname for Teams app registration
- Cosmos DB connection strings for persistence