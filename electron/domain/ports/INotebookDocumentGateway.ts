import type { PermissionMode } from '../entities/agent.js';

export type NotebookDocumentRequest = {
  notebookPath: string;
  workspaceRoot: string;
  permissionMode: PermissionMode;
};

export type NotebookDocumentSnapshot = {
  path: string;
  workspaceRoot: string;
  content: string;
  mode: number;
  observedContent?: string;
};

export interface INotebookDocumentGateway {
  read(input: NotebookDocumentRequest, observe: boolean): Promise<NotebookDocumentSnapshot>;
  write(snapshot: NotebookDocumentSnapshot, updatedContent: string): Promise<void>;
}
