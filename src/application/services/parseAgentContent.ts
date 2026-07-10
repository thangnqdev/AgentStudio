/**
 * Pure functions để parse nội dung agent message thành các phần có kiểu rõ ràng.
 * Đặt tại application/services để có thể unit-test độc lập với React.
 */

export type AgentContentPart =
  | { type: 'text'; value: string }
  | { type: 'code'; language: string; value: string }
  | { type: 'think'; value: string }
  | { type: 'tool'; actionId: string };

/**
 * Xóa các dòng legacy action log dạng [tool:xxx] khỏi text để render gọn hơn.
 * Dùng cho TextBlock — các action đã được parse riêng thành AgentContentPart.
 */
export function stripLegacyActionLogs(text: string): string {
  const lines = text.split('\n');
  let textBuffer: string[] = [];
  const visible: string[] = [];

  const flushText = () => {
    if (textBuffer.length === 0) return;
    const value = textBuffer.join('\n');
    if (value) visible.push(value);
    textBuffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const toolMatch = line.match(/^\[tool:([^\]]+)\]\s*(.*)$/);
    if (!toolMatch) {
      textBuffer.push(line);
      continue;
    }

    flushText();

    let cursor = index + 1;
    while (cursor < lines.length) {
      const nextLine = lines[cursor];
      if (/^\[tool:([^\]]+)\]/.test(nextLine)) break;
      cursor += 1;
    }
    index = cursor - 1;
  }

  flushText();
  return visible.join('\n').trim();
}

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
  const pattern = /(?:<(?:think|thinking)>([\s\S]*?)(?:<\/(?:think|thinking)>|$))|(?:\[tool:([^\]]+)\])/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...parseTextAndCode(content.slice(lastIndex, match.index)));
    }

    if (match[1] !== undefined) {
      parts.push({ type: 'think', value: match[1] });
    } else if (match[2] !== undefined) {
      parts.push({ type: 'tool', actionId: match[2] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(...parseTextAndCode(content.slice(lastIndex)));
  }

  return parts.length > 0 ? parts : [{ type: 'text', value: content }];
}
