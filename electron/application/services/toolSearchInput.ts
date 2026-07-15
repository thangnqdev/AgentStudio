import {
  MAX_TOOL_SEARCH_QUERY_CHARACTERS,
  MAX_TOOL_SEARCH_RESULTS,
  type ToolSearchInput,
} from '../../domain/entities/toolSearch.js';

export function parseToolSearchInput(raw: Record<string, unknown>): ToolSearchInput {
  const extras = Object.keys(raw).filter((key) => !['query', 'max_results'].includes(key));
  if (extras.length) throw new Error(`Unexpected ToolSearch input properties: ${extras.join(', ')}.`);
  if (typeof raw.query !== 'string' || raw.query.includes('\0')) throw new Error('ToolSearch query is required.');
  const query = raw.query.trim();
  if (!query || query.length > MAX_TOOL_SEARCH_QUERY_CHARACTERS) throw new Error('ToolSearch query is required and must be at most 1000 characters.');
  const value = raw.max_results ?? 5;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > MAX_TOOL_SEARCH_RESULTS) {
    throw new Error(`ToolSearch max_results must be an integer from 1 to ${MAX_TOOL_SEARCH_RESULTS}.`);
  }
  return { query, maxResults: Number(value) };
}
