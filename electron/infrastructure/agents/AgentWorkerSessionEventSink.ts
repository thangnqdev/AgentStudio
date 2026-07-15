import type { AgentActionPayload } from '../../domain/entities/agent.js';
import { summarizeAgentWorker, type AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IAgentWorkerEventSink } from '../../domain/ports/IAgentWorkerEventSink.js';

const MAX_CAPTURED_RESULT_CHARACTERS = 40_000;

export class AgentWorkerSessionEventSink implements IAgentEventSink {
  private readonly worker: AgentWorkerRecord;
  private readonly events: IAgentWorkerEventSink;
  private chunks = '';
  private error = '';

  constructor(worker: AgentWorkerRecord, events: IAgentWorkerEventSink) {
    this.worker = worker;
    this.events = events;
  }

  emitChunk(_requestId: string, chunk: string) {
    if (!chunk) return;
    this.chunks = `${this.chunks}${chunk}`.slice(-MAX_CAPTURED_RESULT_CHARACTERS);
  }

  emitAction(_requestId: string, action: AgentActionPayload) {
    this.events.emitEvent({ scopeId: this.worker.parentScopeId, worker: summarizeAgentWorker(this.worker), action });
  }

  emitDone() {}

  emitError(_requestId: string, error: string) {
    this.error = error;
  }

  result() {
    return this.chunks.trim() || this.error;
  }
}
