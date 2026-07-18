export interface IWorkspaceFileChangeSink {
  fileChanged(filePath: string, workspaceRoot: string): Promise<void>;
}
