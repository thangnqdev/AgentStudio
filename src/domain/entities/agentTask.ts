export interface ResumableTask {
  id: string;
  completedSteps: number;
  title?: string;
  parentTaskId?: string;
  branchDepth?: number;
}
