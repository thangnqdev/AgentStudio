import type { AgentActionPayload } from '../entities/agent.js';

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
}
