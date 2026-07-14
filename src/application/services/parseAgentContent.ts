import type { AgentAction } from '../../domain/entities/message';

export type AgentContentPart =
  | { type: 'text'; value: string }
  | { type: 'code'; language: string; value: string }
  | { type: 'think'; value: string }
  | { type: 'tool'; actionId: string; action?: AgentAction };

/**
 * Parse đoạn text + code fence thành mảng AgentContentPart.
 */
export function parseTextAndCode(content: string): AgentContentPart[] {
  const parts: AgentContentPart[] = [];
  const codeFenceRegex = /```([\w.+-]*)\n([\s\S]*?)(?:```|$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeFenceRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    parts.push({
      type: 'code',
      language: match[1] || 'text',
      value: match[2],
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) });
  }
  return parts;
}

/**
 * Parse toàn bộ nội dung agent message thành mảng AgentContentPart:
 * - <think>...</think> → part kiểu 'think'
 * - [tool:id] → part kiểu 'tool'
 * - code fence → part kiểu 'code'
 * - còn lại → part kiểu 'text'
 */
export function parseAgentContent(content: string): AgentContentPart[] {
  const parts: AgentContentPart[] = [];
  const pattern = /(?:<(?:think|thinking)>([\s\S]*?)(?:<\/(?:think|thinking)>|$))|(?:\[tool:([^\]\r\n]+)\])/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...parseTextAndCode(content.slice(lastIndex, match.index)));
    }

    if (match[1] !== undefined) {
      parts.push({ type: 'think', value: match[1] });
    } else if (match[2] !== undefined) {
      // Tool markers are placeholders. The actual action metadata is held separately
      // on the message, so consuming the text after a marker would incorrectly turn
      // the remainder of the assistant response into tool output.
      parts.push({ type: 'tool', actionId: match[2].trim() });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(...parseTextAndCode(content.slice(lastIndex)));
  }

  return parts.length > 0 ? parts : [{ type: 'text', value: content }];
}
