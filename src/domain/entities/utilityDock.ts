export type UtilityDockSurface =
  | 'activity'
  | 'agent'
  | 'terminal'
  | 'files'
  | 'browser'
  | 'evaluations'
  | 'task-details';

export type UtilityDockToolSurface = Exclude<UtilityDockSurface, 'activity' | 'agent'>;

export type UtilityDockTab = {
  id: string;
  surface: UtilityDockSurface;
  title: string;
  closable: boolean;
  agentId?: string;
};

export type OpenUtilityDockTabInput = Omit<UtilityDockTab, 'id' | 'closable'> & {
  closable?: boolean;
  reuseKey?: string;
};
