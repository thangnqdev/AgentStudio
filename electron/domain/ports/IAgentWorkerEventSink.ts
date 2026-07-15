import type { AgentWorkerEvent, AgentWorkerSummary } from '../entities/agentWorker.js';

export interface IAgentWorkerEventSink {
  emitWorker(worker: AgentWorkerSummary): void;
  emitEvent(event: AgentWorkerEvent): void;
}
