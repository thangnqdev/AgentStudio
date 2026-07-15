export type AgentWorktreeSession = {
  scopeId: string;
  originalWorkspaceRoot: string;
  repositoryCommonDir: string;
  worktreePath: string;
  worktreeName: string;
  worktreeBranch: string;
  originalHeadCommit: string;
  createdAt: string;
};

export type AgentWorktreeChangeSummary = {
  changedFiles: number;
  commits: number;
};

export type AgentWorktreeStatePayload = {
  active: boolean;
  path?: string;
  branch?: string;
};
