export type WorkspaceSurface =
  | 'tasks'
  | 'knowledge'
  | 'observability'
  | 'evaluations'
  | 'workflows'
  | 'capabilities'
  | 'optimizer'
  | 'skill-learning'
  | 'agents'
  | 'settings'
  | 'terminal'
  | 'browser'
  | 'files';

export type WorkspaceTab = {
  id: string;
  surface: WorkspaceSurface;
  title: string;
  threadId?: string;
  sideTask?: boolean;
};

export type OpenWorkspaceTabInput = Omit<WorkspaceTab, 'id'> & {
  reuseKey?: string;
};
