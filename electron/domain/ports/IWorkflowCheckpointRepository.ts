import type { NodeCheckpoint } from '../entities/workflow.js';

export interface IWorkflowCheckpointRepository {
  save(checkpoint: NodeCheckpoint): Promise<void>;
  get(runId: string): Promise<NodeCheckpoint | null>;
  list(limit?: number): Promise<NodeCheckpoint[]>;
}
