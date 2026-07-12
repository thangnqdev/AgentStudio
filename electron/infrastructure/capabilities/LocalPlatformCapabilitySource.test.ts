import { describe, expect, it } from 'vitest';
import { LocalPlatformCapabilitySource } from './LocalPlatformCapabilitySource.js';

describe('LocalPlatformCapabilitySource', () => {
  it('unifies all six capability kinds without granting permissions', async () => {
    const source = new LocalPlatformCapabilitySource({
      tools: async () => [
        { name: 'read_file', description: 'Read', risk: 'read', parameters: {}, source: { kind: 'local' } },
        { name: 'web_search', description: 'Search', risk: 'network', parameters: {}, source: { kind: 'local' } },
        { name: 'github.issue', description: 'Issue', risk: 'write', parameters: {}, source: { kind: 'mcp', serverId: 'github', remoteToolName: 'issue' } },
      ],
      skills: async () => [{ id: 'git', name: 'Git', description: 'Git workflow', origin: 'workspace', rootPath: '/redacted', enabled: true, trusted: true }],
      knowledgeAvailable: async () => true,
      terminalAvailable: async () => true,
    });
    const capabilities = await source.list();
    expect(new Set(capabilities.map((item) => item.kind))).toEqual(new Set(['local_tool', 'mcp_tool', 'knowledge_retrieval', 'skill', 'web_search', 'terminal']));
    expect(capabilities.find((item) => item.kind === 'mcp_tool')).toMatchObject({ sourceId: 'mcp:github', risk: 'write', available: true });
    expect(capabilities.every((item) => !('permissionMode' in item))).toBe(true);
  });
});
