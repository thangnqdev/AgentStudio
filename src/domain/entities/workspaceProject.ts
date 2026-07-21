export interface WorkspaceThreadSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface WorkspaceProjectSummary {
  path: string;
  name: string;
  activeThreadId: string | null;
  threads: WorkspaceThreadSummary[];
}

export interface WorkspaceActivation {
  path: string;
  recentWorkspacePaths: string[];
}
