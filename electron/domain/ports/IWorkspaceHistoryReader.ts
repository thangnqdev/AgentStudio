export interface IWorkspaceHistoryReader {
  loadWorkspaceChatHistory(workspacePath: string): Promise<unknown>;
}
