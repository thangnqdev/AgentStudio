import type { AgentAction, AgentThought, Message } from '../../domain/entities/message';

/**
 * Pure function tính state mới khi có một AgentAction mới.
 * Tách khỏi useAppStore để có thể unit-test độc lập.
 */
export function reduceAgentAction(
  currentActions: AgentAction[],
  currentMessages: Message[],
  action: AgentAction,
): { agentActions: AgentAction[]; messages: Message[] } {
  const exists = currentActions.some((item) => item.id === action.id);
  let messages = currentMessages;

  // Khi action mới xuất hiện: gắn placeholder [tool:id] vào message đang streaming
  if (!exists) {
    const targetMsg = messages.find((m) => m.sender === 'agent' && m.status === 'sending');
    if (targetMsg) {
      messages = messages.map((m) =>
        m.id === targetMsg.id
          ? { ...m, content: m.content + `\n[tool:${action.id}]\n` }
          : m,
      );
    }
  }

  const agentActions = exists
    ? currentActions.map((item) => (item.id === action.id ? { ...item, ...action } : item))
    : [...currentActions, action];

  return { agentActions, messages };
}

type ThoughtReducerState = {
  thoughts: AgentThought[];
  startsNewLine: boolean;
};

/**
 * Pure function tính state mới khi có một chunk thought mới.
 * Tách khỏi useAppStore để có thể unit-test FSM phức tạp này độc lập.
 */
export function reduceAgentThoughtChunk(
  currentState: ThoughtReducerState,
  requestId: string,
  chunk: string,
): ThoughtReducerState {
  const normalizedChunk = chunk.replace(/\r\n/g, '\n');
  if (!normalizedChunk) return currentState;

  const thoughts = [...currentState.thoughts];
  const segments = normalizedChunk.split('\n');
  let startsNewLine = currentState.startsNewLine;

  segments.forEach((segment, index) => {
    const shouldAppend =
      !startsNewLine &&
      segment &&
      thoughts.length > 0 &&
      thoughts[thoughts.length - 1].requestId === requestId;

    if (shouldAppend) {
      const lastThought = thoughts[thoughts.length - 1];
      thoughts[thoughts.length - 1] = {
        ...lastThought,
        content: `${lastThought.content}${segment}`,
        timestamp: new Date(),
      };
    } else if (segment.trim()) {
      thoughts.push({
        id: crypto.randomUUID(),
        requestId,
        content: segment,
        timestamp: new Date(),
      });
    }

    if (segment) {
      startsNewLine = false;
    }
    if (index < segments.length - 1) {
      startsNewLine = true;
    }
  });

  return {
    thoughts: thoughts.filter((t) => t.content.trim()).slice(-120),
    startsNewLine,
  };
}
