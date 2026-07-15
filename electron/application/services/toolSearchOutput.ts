import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import {
  MAX_TOOL_SEARCH_OUTPUT_CHARACTERS,
  type ToolSearchResult,
} from '../../domain/entities/toolSearch.js';

export function formatToolSearchResult(
  query: string,
  totalDeferredTools: number,
  matches: readonly AgentToolDefinition[],
) {
  const functions: string[] = [];
  const included: AgentToolDefinition[] = [];
  for (const tool of matches) {
    const serialized = serializeFunction(tool);
    if (!serialized) continue;
    const candidate = [...functions, serialized];
    const result = envelope(query, totalDeferredTools, [...included.map((item) => item.name), tool.name]);
    const output = render(result, candidate);
    if (output.length > MAX_TOOL_SEARCH_OUTPUT_CHARACTERS) continue;
    included.push(tool); functions.push(serialized);
  }
  const result = envelope(query, totalDeferredTools, included.map((tool) => tool.name));
  return { result, output: render(result, functions), included };
}

function envelope(query: string, total: number, matches: string[]): ToolSearchResult {
  return { matches, query, total_deferred_tools: total };
}

function render(result: ToolSearchResult, functions: string[]) {
  const header = JSON.stringify(result);
  return functions.length ? `${header}\n<functions>\n${functions.join('\n')}\n</functions>` : header;
}

function serializeFunction(tool: AgentToolDefinition) {
  try {
    return `<function>${JSON.stringify({ description: tool.description, name: tool.name, parameters: tool.parameters })}</function>`;
  } catch { return ''; }
}
