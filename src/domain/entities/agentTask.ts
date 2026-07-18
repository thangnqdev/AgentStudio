export interface ResumableTask {
  id: string;
  completedSteps: number;
  title?: string;
  status?: 'paused' | 'failed';
  updatedAt?: string;
  lastError?: string;
  parentTaskId?: string;
  branchDepth?: number;
}
