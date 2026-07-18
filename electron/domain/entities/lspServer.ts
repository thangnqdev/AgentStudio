export type LspServerConfiguration = {
  name: string;
  command: string;
  args?: string[];
  extensionToLanguage: Record<string, string>;
  env?: Record<string, string>;
  initializationOptions?: unknown;
  settings?: unknown;
  workspaceFolder?: string;
  startupTimeoutMs?: number;
  maxRestarts?: number;
};
