import type { Message } from '../entities/agent.js';
import type { AgentWorkerCheckpoint, AgentWorkerRecord } from '../entities/agentWorker.js';

export type AgentWorkerRunCallbacks = {
  checkpoint(checkpoint: AgentWorkerCheckpoint): Promise<void>;
  drainMessages(): Promise<Message[]>;
};

export type AgentWorkerRunResult = {
  status: 'completed' | 'paused';
  completedSteps: number;
  result: string;
  worktreePath?: string;
  worktreeBranch?: string;
};

export interface IAgentWorkerRunner {
  run(worker: AgentWorkerRecord, callbacks: AgentWorkerRunCallbacks, signal: AbortSignal): Promise<AgentWorkerRunResult>;
}
