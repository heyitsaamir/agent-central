export interface SupportConfig {
  githubRepo: string;
  githubToken: string;
  labels: string[];
  autoCreateIssues: boolean;
}

export interface ConfigStorage {
  save(conversationId: string, config: SupportConfig): Promise<void>;
  get(conversationId: string): Promise<SupportConfig | null>;
}

export interface ConfigCardData {
  action: "submit_config";
  conversationId: string;
}
