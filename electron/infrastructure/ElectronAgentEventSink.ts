import type { WebContents } from 'electron';
import type { IAgentEventSink } from '../domain/ports/IAgentEventSink.js';
import type { AgentActionPayload, AgentTaskStatusPayload } from '../domain/entities/agent.js';
import type { AgentInteractionRequest } from '../domain/entities/agentInteraction.js';
import type { AgentPlanModePayload } from '../domain/entities/agentPlan.js';

/**
 * Infrastructure implementation của IAgentEventSink.
 * Lớp DUY NHẤT được phép dùng WebContents để send IPC events về renderer.
 */
export class ElectronAgentEventSink implements IAgentEventSink {
  private readonly sender: WebContents;

  constructor(sender: WebContents) {
    this.sender = sender;
  }

  emitChunk(requestId: string, chunk: string): void {
    if (chunk) {
      this.sender.send('ai:chat:chunk', { requestId, chunk });
    }
  }

  emitAction(requestId: string, action: AgentActionPayload): void {
    this.sender.send('ai:chat:action', { requestId, action });
  }

  emitDone(requestId: string): void {
    this.sender.send('ai:chat:done', { requestId });
  }

  emitError(requestId: string, error: string): void {
    this.sender.send('ai:chat:error', { requestId, error });
  }

  emitTaskStatus(requestId: string, task: AgentTaskStatusPayload): void {
    this.sender.send('ai:chat:task-status', { requestId, task });
  }

  emitInteraction(requestId: string, interaction: AgentInteractionRequest): void {
    this.sender.send('ai:chat:interaction', { requestId, interaction });
  }

  emitPlanMode(requestId: string, planMode: AgentPlanModePayload): void {
    this.sender.send('ai:chat:plan-mode', { requestId, planMode });
  }
}
