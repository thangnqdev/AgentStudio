import type { WebContents } from 'electron';
import type { AgentWorkerEvent, AgentWorkerSummary } from '../../domain/entities/agentWorker.js';
import type { IAgentWorkerEventSink } from '../../domain/ports/IAgentWorkerEventSink.js';

export class ElectronAgentWorkerEventSink implements IAgentWorkerEventSink {
  private readonly sender: WebContents;

  constructor(sender: WebContents) {
    this.sender = sender;
  }

  emitWorker(worker: AgentWorkerSummary) {
    if (!this.sender.isDestroyed()) this.sender.send('ai:agent-worker:event', { scopeId: worker.parentScopeId, worker });
  }

  emitEvent(event: AgentWorkerEvent) {
    if (!this.sender.isDestroyed()) this.sender.send('ai:agent-worker:event', event);
  }
}
