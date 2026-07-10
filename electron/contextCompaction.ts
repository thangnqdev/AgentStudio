export type CompactableAttachment = {
  name: string;
  type: 'text' | 'image' | 'audio' | 'video';
  data?: string;
  filePath?: string;
  mimeType?: string;
  size?: number;
};

export type CompactableMessage = {
  sender: 'user' | 'agent';
  content: string;
  attachments?: CompactableAttachment[];
};

export type CompactedContext<TMessage extends CompactableMessage = CompactableMessage> = {
  recentMessages: TMessage[];
  summary: string | null;
  didCompact: boolean;
  originalApproxTokens: number;
  compactedApproxTokens: number;
};

const DEFAULT_MAX_CONTEXT_TOKENS = 24_000;
const MAX_SUMMARY_CHARS = 10_000;
const MAX_AGENT_TEXT_CHARS = 900;
const MAX_TOOL_OUTPUT_CHARS = 900;
const MAX_USER_TEXT_CHARS = 1_400;

export function compactContext<TMessage extends CompactableMessage>(messages: TMessage[], maxContextTokens = DEFAULT_MAX_CONTEXT_TOKENS): CompactedContext<TMessage> {
  const recentContextTargetTokens = getRecentContextTargetTokens(maxContextTokens);
  const originalApproxTokens = estimateMessagesTokens(messages);
  if (originalApproxTokens <= maxContextTokens) {
    return {
      recentMessages: messages,
      summary: null,
      didCompact: false,
      originalApproxTokens,
      compactedApproxTokens: originalApproxTokens,
    };
  }

  const recentMessages: TMessage[] = [];
  let recentTokens = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const messageTokens = estimateMessageTokens(message);
    if (recentMessages.length > 0 && recentTokens + messageTokens > recentContextTargetTokens) {
      break;
    }

    recentMessages.unshift(message);
    recentTokens += messageTokens;
  }

  const olderMessages = messages.slice(0, Math.max(0, messages.length - recentMessages.length));
  const summary = buildCompactionSummary(olderMessages);
  const compactedApproxTokens = recentTokens + estimateTextTokens(summary);

  return {
    recentMessages,
    summary,
    didCompact: true,
    originalApproxTokens,
    compactedApproxTokens,
  };
}

function getRecentContextTargetTokens(maxContextTokens: number) {
  return Math.max(1_000, Math.floor(maxContextTokens * 0.65));
}

export function buildSummarySystemMessage(summary: string) {
  return [
    'The conversation history before the recent messages was locally compacted by AgentStudio.',
    'Use this summary as prior context. It may omit low-level logs, but it preserves user goals, decisions, files, tool results, and unresolved work.',
    '',
    summary,
  ].join('\n');
}

export function estimateMessagesTokens(messages: CompactableMessage[]) {
  return messages.reduce((total, message) => total + estimateMessageTokens(message), 0);
}

function estimateMessageTokens(message: CompactableMessage) {
  const attachmentText = (message.attachments || [])
    .map((attachment) => [
      attachment.name,
      attachment.type,
      attachment.filePath || '',
      attachment.mimeType || '',
      attachment.size || '',
      attachment.type === 'text' ? attachment.data || '' : '',
    ].join(' '))
    .join('\n');
  return estimateTextTokens(`${message.sender}\n${message.content}\n${attachmentText}`);
}

function estimateTextTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function buildCompactionSummary(messages: CompactableMessage[]) {
  const sections: string[] = [];
  const userRequests: string[] = [];
  const agentNotes: string[] = [];
  const toolEvents: string[] = [];
  const files = new Set<string>();
  const openItems = new Set<string>();

  for (const message of messages) {
    collectFilePaths(message.content, files);
    for (const attachment of message.attachments || []) {
      files.add(attachment.name);
    }

    if (message.sender === 'user') {
      userRequests.push(`- ${cleanInlineText(message.content, MAX_USER_TEXT_CHARS)}`);
      continue;
    }

    const parsedToolEvents = parseToolEvents(message.content);
    if (parsedToolEvents.length > 0) {
      toolEvents.push(...parsedToolEvents);
    }

    const cleanedAgentText = cleanAgentText(message.content);
    if (cleanedAgentText) {
      agentNotes.push(`- ${cleanedAgentText}`);
    }

    for (const line of message.content.split('\n')) {
      if (/\b(todo|next|cần|chưa|remaining|follow[- ]?up|blocked|lỗi)\b/i.test(line)) {
        openItems.add(cleanInlineText(line, 260));
      }
    }
  }

  if (userRequests.length > 0) {
    sections.push(`User goals and requests:\n${lastItems(userRequests, 18).join('\n')}`);
  }
  if (agentNotes.length > 0) {
    sections.push(`Agent conclusions and decisions:\n${lastItems(agentNotes, 18).join('\n')}`);
  }
  if (toolEvents.length > 0) {
    sections.push(`Tool activity and results:\n${lastItems(toolEvents, 28).join('\n')}`);
  }
  if (files.size > 0) {
    sections.push(`Files and paths mentioned:\n${[...files].slice(-80).map((file) => `- ${file}`).join('\n')}`);
  }
  if (openItems.size > 0) {
    sections.push(`Open issues and follow-ups:\n${[...openItems].slice(-20).map((item) => `- ${item}`).join('\n')}`);
  }

  const summary = sections.join('\n\n') || 'Older context contained no durable information.';
  return truncate(summary, MAX_SUMMARY_CHARS);
}

function parseToolEvents(content: string) {
  const events: string[] = [];
  const lines = content.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const toolMatch = line.match(/^\[tool:([^\]]+)\]\s*(.*)$/);
    if (!toolMatch) continue;

    let status = 'unknown';
    const output: string[] = [];
    let cursor = index + 1;
    while (cursor < lines.length) {
      const nextLine = lines[cursor];
      if (/^\[tool:([^\]]+)\]/.test(nextLine)) break;
      if (nextLine === '[ok]') {
        status = 'ok';
      } else if (nextLine === '[blocked/error]') {
        status = 'blocked/error';
      } else {
        output.push(nextLine);
      }
      cursor += 1;
    }

    const outputText = cleanInlineText(output.join('\n'), MAX_TOOL_OUTPUT_CHARS);
    events.push(`- ${toolMatch[1]} ${toolMatch[2] || '{}'} => ${status}${outputText ? `; ${outputText}` : ''}`);
    index = cursor - 1;
  }

  return events;
}

function cleanAgentText(content: string) {
  const withoutTools = content
    .split('\n')
    .filter((line) => !/^\[tool:/.test(line) && line !== '[ok]' && line !== '[blocked/error]')
    .join('\n');
  const withoutCode = withoutTools.replace(/```([\w.+-]*)\n[\s\S]*?```/g, (_match, language) => `[${language || 'text'} code block omitted]`);
  return cleanInlineText(withoutCode, MAX_AGENT_TEXT_CHARS);
}

function cleanInlineText(text: string, maxChars: number) {
  return truncate(
    text
      .replace(/```([\w.+-]*)\n[\s\S]*?```/g, (_match, language) => `[${language || 'text'} code block omitted]`)
      .replace(/\s+/g, ' ')
      .trim(),
    maxChars,
  );
}

function collectFilePaths(text: string, files: Set<string>) {
  const pathRegex = /(?:^|[\s`'"])((?:\.{1,2}\/)?(?:[\w.-]+\/)+[\w.@-]+\.[A-Za-z0-9]+|[\w.-]+\.(?:ts|tsx|js|jsx|json|css|md|html|mjs|cjs|py|rs|go|java|kt|swift|toml|yaml|yml))/g;
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(text)) !== null) {
    files.add(match[1]);
  }
}

function truncate(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n[truncated]`;
}

function lastItems(items: string[], count: number) {
  return items.slice(Math.max(0, items.length - count));
}
