import type { AgentAction, Message } from '../store/useAppStore';

export function streamChatCompletion(
  messages: Message[],
  onChunk: (chunk: string) => void,
  onFinish?: () => void,
  onError?: (error: string) => void,
  onRequestId?: (requestId: string) => void,
  onAction?: (action: AgentAction) => void,
  onThought?: (thought: string, requestId: string) => void,
) {
  return new Promise<void>((resolve) => {
    const bridge = window.agentStudio;
    if (!bridge) {
      onError?.('Electron bridge is not available.');
      resolve();
      return;
    }

    const requestId = crypto.randomUUID();
    onRequestId?.(requestId);
    const cleanupCallbacks: Array<() => void> = [];
    const thoughtEmitter = createBufferedTextEmitter((thought) => onThought?.(thought, requestId), 120);
    const thinkingFilter = createThinkingFilter((thought) => thoughtEmitter.push(thought));
    let settled = false;

    const cleanup = () => {
      for (const callback of cleanupCallbacks) {
        callback();
      }
    };

    cleanupCallbacks.push(
      bridge.onChatChunk((payload) => {
        if (payload.requestId === requestId && payload.chunk) {
          const visibleChunk = thinkingFilter.push(payload.chunk);
          if (visibleChunk) {
            onChunk(visibleChunk);
          }
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
        thinkingFilter.flush();
        thoughtEmitter.clear();
        onError?.(payload.error || 'Unknown error occurred');
        resolve();
      }),
    );

    async function finishSuccessfully() {
      if (settled) return;
      settled = true;
      cleanup();
      const visibleTail = thinkingFilter.flush();
      if (visibleTail) {
        onChunk(visibleTail);
      }
      thoughtEmitter.flushNow();
      onFinish?.();
      resolve();
    }

    bridge.startChat({ requestId, messages });
  });
}

export function stopChatCompletion(requestId: string) {
  window.agentStudio?.stopChat(requestId);
}

function createThinkingFilter(onThought: (thought: string) => void) {
  let buffer = '';
  let hidden = false;

  const openingTags = ['<think>', '<thinking>'];
  const closingTags = ['</think>', '</thinking>'];

  return {
    push(chunk: string) {
      buffer += chunk;
      let visible = '';

      while (buffer) {
        const lowerBuffer = buffer.toLowerCase();

        if (hidden) {
          const close = findEarliestTag(lowerBuffer, closingTags);
          if (!close) {
            const tail = keepPotentialTagPrefix(buffer, closingTags);
            const thought = buffer.slice(0, buffer.length - tail.length);
            emitThought(onThought, thought);
            buffer = tail;
            return visible;
          }

          emitThought(onThought, buffer.slice(0, close.index));
          buffer = buffer.slice(close.index + close.tag.length);
          hidden = false;
          continue;
        }

        const open = findEarliestTag(lowerBuffer, openingTags);
        if (!open) {
          const tail = keepPotentialTagPrefix(buffer, openingTags);
          visible += buffer.slice(0, buffer.length - tail.length);
          buffer = tail;
          return visible;
        }

        visible += buffer.slice(0, open.index);
        buffer = buffer.slice(open.index + open.tag.length);
        hidden = true;
      }

      return visible;
    },
    flush() {
      if (hidden) {
        emitThought(onThought, buffer);
        buffer = '';
        hidden = false;
        return '';
      }

      const tail = buffer;
      buffer = '';
      return tail;
    },
  };
}

function emitThought(onThought: (thought: string) => void, thought: string) {
  if (thought) {
    onThought(thought);
  }
}

function createBufferedTextEmitter(onChunk: (chunk: string) => void, delayMs: number) {
  let queue = '';
  let timer: number | null = null;

  const flushNow = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    if (!queue) return;

    const chunk = queue;
    queue = '';
    onChunk(chunk);
  };

  return {
    push(chunk: string) {
      if (!chunk) return;
      queue += chunk;
      if (timer === null) {
        timer = window.setTimeout(flushNow, delayMs);
      }
    },
    flushNow,
    clear() {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      queue = '';
    },
  };
}

function findEarliestTag(text: string, tags: string[]) {
  let best: { index: number; tag: string } | null = null;
  for (const tag of tags) {
    const index = text.indexOf(tag);
    if (index >= 0 && (!best || index < best.index)) {
      best = { index, tag };
    }
  }
  return best;
}

function keepPotentialTagPrefix(text: string, tags: string[]) {
  const lowerText = text.toLowerCase();
  let keepLength = 0;

  for (const tag of tags) {
    for (let length = 1; length < tag.length; length += 1) {
      if (lowerText.endsWith(tag.slice(0, length))) {
        keepLength = Math.max(keepLength, length);
      }
    }
  }

  return keepLength > 0 ? text.slice(-keepLength) : '';
}
