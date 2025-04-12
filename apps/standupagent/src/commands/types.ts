import { IActivityContext } from "@microsoft/spark.apps";

export interface CommandContext {
  app: IActivityContext["app"];
  send: IActivityContext["send"];
  conversationId: string;
  userId: string;
  userName: string;
  api: IActivityContext["api"];
  mentions: Array<{ id: string; name: string }>;
  signin?: IActivityContext["signin"];
  isSignedIn?: IActivityContext["isSignedIn"];
  signout?: IActivityContext["signout"];
  tenantId: string;
}

export interface Command {
  name: string;
  execute: (context: CommandContext) => Promise<void>;
}
