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
    const textEmitter = createReadableTextEmitter(onChunk);
    const thinkingFilter = createThinkingFilter((thought) => onThought?.(thought, requestId));
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
            textEmitter.push(visibleChunk);
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
        textEmitter.clear();
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
        textEmitter.push(visibleTail);
      }
      await textEmitter.drain();
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

function createReadableTextEmitter(onChunk: (chunk: string) => void) {
  const tickMs = 40;
  const charsPerSecond = 70;
  const baseCharsPerTick = Math.max(1, Math.round(charsPerSecond * tickMs / 1000));
  let queue = '';
  let timer: number | null = null;
  let drainResolvers: Array<() => void> = [];

  const resolveDrain = () => {
    if (queue || timer !== null) return;
    for (const resolver of drainResolvers) {
      resolver();
    }
    drainResolvers = [];
  };

  const pump = () => {
    if (!queue) {
      timer = null;
      resolveDrain();
      return;
    }

    const boost = queue.length > 4000 ? 5 : queue.length > 1800 ? 3 : queue.length > 700 ? 2 : 1;
    const nextSize = Math.min(queue.length, baseCharsPerTick * boost);
    const nextChunk = queue.slice(0, nextSize);
    queue = queue.slice(nextSize);
    onChunk(nextChunk);

    timer = window.setTimeout(pump, tickMs);
  };

  const schedule = () => {
    if (timer === null) {
      timer = window.setTimeout(pump, tickMs);
    }
  };

  return {
    push(chunk: string) {
      if (!chunk) return;
      queue += chunk;
      schedule();
    },
    drain() {
      if (!queue && timer === null) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        drainResolvers.push(resolve);
      });
    },
    clear() {
      queue = '';
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      resolveDrain();
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
