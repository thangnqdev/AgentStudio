import type { AgentWorkerRecord } from '../../domain/entities/agentWorker.js';

export function buildWorkerGuidance(worker: AgentWorkerRecord, profile?: string) {
  return [
    `You are agent ${worker.name || worker.id} working for a parent coding agent.`,
    `Delegated task: ${worker.description}. Complete it autonomously and return concrete evidence.`,
    'Use SendMessage when the parent sends new instructions. Nested Agent calls must remain synchronous.',
    profile || '',
  ].join('\n');
}
