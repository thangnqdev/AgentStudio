import type { AgentActionPayload, AgentTaskStatusPayload } from '../entities/agent.js';
import type { AgentInteractionRequest } from '../entities/agentInteraction.js';
import type { AgentPlanModePayload } from '../entities/agentPlan.js';
import type { AgentWorktreeStatePayload } from '../entities/agentWorktree.js';

/**
 * Port trừu tượng để use-case gửi sự kiện streaming về phía renderer mà không
 * cần biết đến Electron WebContents. Implementation cụ thể nằm ở infrastructure/.
 */
export interface IAgentEventSink {
  /** Gửi một đoạn text streaming từ model về renderer. */
  emitChunk(requestId: string, chunk: string): void;
  /** Gửi cập nhật trạng thái của một tool action. */
  emitAction(requestId: string, action: AgentActionPayload): void;
  /** Báo hiệu phiên hoàn tất thành công. */
  emitDone(requestId: string): void;
  /** Báo hiệu lỗi về phía renderer. */
  emitError(requestId: string, error: string): void;
  /** Emits durable task progress so the renderer can offer resume controls. */
  emitTaskStatus?(requestId: string, task: AgentTaskStatusPayload): void;
  /** Requests a structured, session-scoped response from the local user. */
  emitInteraction?(requestId: string, interaction: AgentInteractionRequest): void;
  /** Reports the authoritative plan-mode state after the main process commits it. */
  emitPlanMode?(requestId: string, planMode: AgentPlanModePayload): void;
  /** Reports the chat-scoped managed worktree selected by the main process. */
  emitWorktree?(requestId: string, worktree: AgentWorktreeStatePayload): void;
}
