import { describe, expect, it } from 'vitest';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import { parseToolSearchInput } from './toolSearchInput.js';
import { searchDeferredTools } from './toolSearchRanking.js';

const tools: AgentToolDefinition[] = [
  tool('TeamCreate', 'Create a multi-agent coordination team.', 'create swarm team'),
  tool('task_update', 'Update task ownership and status.', 'assign task owner'),
  { ...tool('mcp_deadbeef_create_issue', 'External GitHub issue creator.'), source: { kind: 'mcp', serverId: 'github', remoteToolName: 'create_issue' } },
  tool('read_file', 'Read a local file.'),
];

describe('toolSearchRanking', () => {
  it('supports case-insensitive direct multi-selection and exact loaded no-ops', () => {
    expect(searchDeferredTools('select:teamcreate, READ_FILE, missing', tools.slice(0, 3), tools, 5))
      .toEqual(['TeamCreate', 'read_file']);
    expect(searchDeferredTools('read_file', tools.slice(0, 3), tools, 5)).toEqual(['read_file']);
  });

  it('ranks names, descriptions, hints, required terms, and MCP prefixes', () => {
    expect(searchDeferredTools('team create', tools.slice(0, 3), tools, 5)[0]).toBe('TeamCreate');
    expect(searchDeferredTools('+task owner', tools.slice(0, 3), tools, 5)).toEqual(['task_update']);
    expect(searchDeferredTools('mcp_deadbeef', tools.slice(0, 3), tools, 5)).toEqual(['mcp_deadbeef_create_issue']);
    const localIssueTool = tool('create_issue', 'External GitHub issue creator.');
    expect(searchDeferredTools('issue', [localIssueTool, tools[2]], [...tools, localIssueTool], 5)[0])
      .toBe('mcp_deadbeef_create_issue');
  });

  it('strictly validates bounded input', () => {
    expect(parseToolSearchInput({ query: ' notebook ', max_results: 3 })).toEqual({ query: 'notebook', maxResults: 3 });
    expect(() => parseToolSearchInput({ query: '', extra: true })).toThrow('Unexpected');
    expect(() => parseToolSearchInput({ query: 'x', max_results: 0 })).toThrow('integer');
    expect(() => parseToolSearchInput({ query: 'x', max_results: 1.5 })).toThrow('integer');
  });
});

function tool(name: string, description: string, searchHint?: string): AgentToolDefinition {
  return { name, description, ...(searchHint ? { searchHint } : {}), risk: 'read', parameters: { type: 'object', properties: {} }, deferLoading: name !== 'read_file' };
}
