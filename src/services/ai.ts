import type { Message } from '../store/useAppStore';

export function streamChatCompletion(
  messages: Message[],
  onChunk: (chunk: string) => void,
  onFinish?: () => void,
  onError?: (error: string) => void,
) {
  return new Promise<void>((resolve) => {
    const bridge = window.agentStudio;
    if (!bridge) {
      onError?.('Electron bridge is not available.');
      resolve();
      return;
    }

    const requestId = crypto.randomUUID();
    const cleanupCallbacks: Array<() => void> = [];

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
      bridge.onChatDone((payload) => {
        if (payload.requestId !== requestId) return;

        cleanup();
        onFinish?.();
        resolve();
      }),
      bridge.onChatError((payload) => {
        if (payload.requestId !== requestId) return;

        cleanup();
        onError?.(payload.error || 'Unknown error occurred');
        resolve();
      }),
    );

    bridge.startChat({ requestId, messages });
  });
}
