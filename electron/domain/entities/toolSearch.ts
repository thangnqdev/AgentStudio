import type { AgentToolDefinition } from './tool.js';

export const TOOL_SEARCH_TOOL_NAME = 'ToolSearch';
export const MAX_TOOL_SEARCH_QUERY_CHARACTERS = 1_000;
export const MAX_TOOL_SEARCH_RESULTS = 20;
export const MAX_TOOL_SEARCH_OUTPUT_CHARACTERS = 100_000;

export type ToolSearchInput = { query: string; maxResults: number };
export type ToolSearchResult = {
  matches: string[];
  query: string;
  total_deferred_tools: number;
};

export const TOOL_SEARCH_TOOL_DEFINITION: AgentToolDefinition = {
  name: TOOL_SEARCH_TOOL_NAME,
  description: 'Fetch complete schema definitions for deferred tools by exact selection or keyword search.',
  risk: 'read',
  concurrencySafe: true,
  alwaysLoad: true,
  parameters: {
    type: 'object', additionalProperties: false,
    properties: {
      query: { type: 'string', description: 'Use select:ToolName,OtherTool or capability keywords.' },
      max_results: { type: 'integer', minimum: 1, maximum: MAX_TOOL_SEARCH_RESULTS, description: 'Maximum keyword matches; defaults to 5.' },
    },
    required: ['query'],
  },
};

export function isDeferredTool(tool: AgentToolDefinition) {
  if (tool.name === TOOL_SEARCH_TOOL_NAME || tool.alwaysLoad === true) return false;
  return tool.source?.kind === 'mcp' || tool.deferLoading === true;
}
