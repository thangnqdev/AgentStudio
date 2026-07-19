import type { WorkspaceFileContent, WorkspaceFileEntry } from '../entities/workspaceFile.js';

export interface IWorkspaceFileBrowser {
  list(workspaceRoot: string, relativeDirectory: string): Promise<WorkspaceFileEntry[]>;
  read(workspaceRoot: string, relativePath: string): Promise<WorkspaceFileContent>;
}
