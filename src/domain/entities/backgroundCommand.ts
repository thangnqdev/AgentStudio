export type BackgroundCommandNotice = {
  id: string;
  scopeId: string;
  description: string;
  status: 'completed' | 'failed' | 'stopped';
  endedAt: string;
  exitCode: number | null;
  error?: string;
};
