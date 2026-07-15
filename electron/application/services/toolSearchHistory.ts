import type { Message } from '../../domain/entities/agent.js';
import { TOOL_SEARCH_TOOL_NAME } from '../../domain/entities/toolSearch.js';

const SAFE_TOOL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;

export function extractLoadedToolNames(messages: readonly Message[]) {
  const loaded = new Set<string>();
  for (const message of messages) {
    for (const action of message.actions ?? []) {
      if (action.toolName === TOOL_SEARCH_TOOL_NAME && action.status === 'ok') collectMatches(action.output, loaded);
    }
    if (message.sender === 'agent') collectContentMatches(message.content, loaded);
  }
  return loaded;
}

function collectContentMatches(content: string, loaded: Set<string>) {
  const lines = content.split('\n');
  let inSearchResult = false;
  for (const line of lines) {
    if (line.startsWith('[tool:')) inSearchResult = line.startsWith(`[tool:${TOOL_SEARCH_TOOL_NAME}]`);
    else if (inSearchResult && line.startsWith('{')) collectMatches(line, loaded);
  }
}

function collectMatches(raw: string | undefined, loaded: Set<string>) {
  if (!raw) return;
  const firstLine = raw.split('\n', 1)[0];
  try {
    const parsed = JSON.parse(firstLine) as { matches?: unknown };
    if (!Array.isArray(parsed.matches)) return;
    for (const name of parsed.matches) if (typeof name === 'string' && SAFE_TOOL_NAME.test(name)) loaded.add(name);
  } catch { /* Ignore historical or untrusted output that is not our bounded result envelope. */ }
}
