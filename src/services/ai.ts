import type { AgentAction, Message } from '../domain/entities/message';
import type { AgentInteractionRequest } from '../domain/entities/agentInteraction';
import type { AgentWorktreeState } from '../domain/entities/agentWorktree';
import { AgentBridge } from '../infrastructure/ipc/agentStudioBridge';

export function streamChatCompletion(
  messages: Message[],
  onChunk: (chunk: string) => void,
  onFinish?: () => void,
  onError?: (error: string) => void,
  onRequestId?: (requestId: string) => void,
  onAction?: (action: AgentAction) => void,
  _onThought?: (thought: string, requestId: string) => void,
  onTaskStatus?: (task: { taskId: string; status: 'paused' | 'completed'; completedSteps: number }) => void,
  onInteraction?: (interaction: AgentInteractionRequest, requestId: string) => void,
  onPlanMode?: (active: boolean, requestId: string) => void,
  onWorktree?: (worktree: AgentWorktreeState, requestId: string) => void,
  taskId?: string,
  taskListId?: string,
) {
  return new Promise<void>((resolve) => {
    const bridge = AgentBridge;
    if (!bridge) {
      onError?.('Electron bridge is not available.');
      resolve();
      return;
    }

    const requestId = crypto.randomUUID();
    onRequestId?.(requestId);
    const cleanupCallbacks: Array<() => void> = [];
    let settled = false;

    const cleanup = () => {
      for (const callback of cleanupCallbacks) {
        callback();
      }
    };

    cleanupCallbacks.push(
      bridge.onChatChunk((payload) => {
        if (payload.requestId === requestId && payload.chunk) {
          onChunk(payload.chunk);
        }
      }),
      bridge.onChatAction((payload) => {
        if (payload.requestId === requestId && payload.action) {
          onAction?.({ ...payload.action, requestId });
        }
      }),
      bridge.onChatDone((payload) => {
        if (payload.requestId !== requestId) return;

        void finishSuccessfully();
      }),
      bridge.onChatError((payload) => {
        if (payload.requestId !== requestId) return;

        if (settled) return;
        settled = true;
        cleanup();
        onError?.(payload.error || 'Unknown error occurred');
        resolve();
      }),
      bridge.onChatTaskStatus((payload) => {
        if (payload.requestId === requestId && payload.task) onTaskStatus?.(payload.task);
      }),
      bridge.onChatInteraction((payload) => {
        if (payload.requestId === requestId && payload.interaction) onInteraction?.(payload.interaction, requestId);
      }),
      bridge.onChatPlanMode((payload) => {
        if (payload.requestId === requestId && payload.planMode) onPlanMode?.(payload.planMode.active, requestId);
      }),
      bridge.onChatWorktree((payload) => {
        if (payload.requestId === requestId && payload.worktree) onWorktree?.(payload.worktree, requestId);
      }),
    );

    async function finishSuccessfully() {
      if (settled) return;
      settled = true;
      cleanup();
      onFinish?.();
      resolve();
    }

    bridge.startChat({ requestId, messages, taskId, taskListId });
  });
}

export function stopChatCompletion(requestId: string) {
  if (AgentBridge.isAvailable) AgentBridge.stopChat(requestId);
}
