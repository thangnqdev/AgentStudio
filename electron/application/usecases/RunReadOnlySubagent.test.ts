import { describe, expect, it, vi } from 'vitest';
import type { AssistantResponse, ChatMessage } from '../../domain/entities/agent.js';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import { RunReadOnlySubagent } from './RunReadOnlySubagent.js';

const readTool: AgentToolDefinition = { name: 'read_file', description: '', risk: 'read', parameters: { properties: { path: { type: 'string' } }, required: ['path'] } };
const writeTool: AgentToolDefinition = { name: 'write_file', description: '', risk: 'write', parameters: { properties: {} } };
const listTool: AgentToolDefinition = { name: 'list_files', description: '', risk: 'read', parameters: { properties: {} } };
const settings = { baseUrl: 'https://provider.invalid', apiKey: '', model: 'model', permissionMode: 'workspace-write' as const, retryCount: 0 };

describe('RunReadOnlySubagent', () => {
  it('offers and executes only allow-listed local read tools', async () => {
    const execute = vi.fn(async () => ({ ok: true, output: 'file contents' }));
    const seenTools: string[][] = [];
    const provider = sequenceProvider([
      { role: 'assistant', content: '', tool_calls: [{ id: 'read-1', function: { name: 'read_file', arguments: '{"path":"README.md"}' } }] },
      { role: 'assistant', content: 'Evidence found.' },
    ], seenTools);
    const runner = new RunReadOnlySubagent(
      provider, { list: async () => [readTool, writeTool] }, { execute }, settings,
      { evaluate: async () => ({ allowed: true, requiresApproval: false }) },
    );
    await expect(runner.run({ prompt: 'Inspect docs', role: 'explore', workspaceRoot: '/workspace' })).resolves.toMatchObject({ content: 'Evidence found.', status: 'completed', steps: 2 });
    expect(seenTools).toEqual([['read_file'], ['read_file']]);
    expect(execute).toHaveBeenCalledWith('read_file', { path: 'README.md' }, '/workspace', 'read-only', undefined);
  });

  it('blocks hallucinated writes and reads that require interactive approval', async () => {
    const execute = vi.fn(async () => ({ ok: true, output: 'should not run' }));
    const provider = sequenceProvider([
      { role: 'assistant', content: '', tool_calls: [{ id: 'write-1', function: { name: 'write_file', arguments: '{}' } }] },
      { role: 'assistant', content: '', tool_calls: [{ id: 'read-1', function: { name: 'read_file', arguments: '{"path":"secret.txt"}' } }] },
      { role: 'assistant', content: 'Could not inspect restricted content.' },
    ]);
    const runner = new RunReadOnlySubagent(
      provider, { list: async () => [readTool, writeTool] }, { execute }, settings,
      { evaluate: async () => ({ allowed: true, requiresApproval: true }) },
    );
    const result = await runner.run({ prompt: 'Inspect', role: 'review', workspaceRoot: '/workspace' });
    expect(result.content).toContain('restricted');
    expect(execute).not.toHaveBeenCalled();
  });

  it('stops an endlessly tool-calling subagent at the fixed step limit', async () => {
    const provider = { requestAssistantMessage: vi.fn(async () => ({ role: 'assistant' as const, content: 'working', tool_calls: [{ id: '', function: { name: 'read_file', arguments: '{"path":"README.md"}' } }] })) };
    const runner = new RunReadOnlySubagent(
      provider, { list: async () => [readTool] }, { execute: async () => ({ ok: true, output: 'contents' }) }, settings,
      { evaluate: async () => ({ allowed: true, requiresApproval: false }) },
    );
    await expect(runner.run({ prompt: 'Inspect', role: 'plan', workspaceRoot: '/workspace' })).resolves.toMatchObject({ status: 'step_limit', steps: 8 });
    expect(provider.requestAssistantMessage).toHaveBeenCalledTimes(8);
  });

  it('honors the root session cancellation signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const provider = { requestAssistantMessage: vi.fn() };
    const runner = new RunReadOnlySubagent(
      provider, { list: async () => [readTool] }, { execute: async () => ({ ok: true, output: '' }) }, settings,
      { evaluate: async () => ({ allowed: true, requiresApproval: false }) }, controller.signal,
    );
    await expect(runner.run({ prompt: 'Inspect', role: 'explore', workspaceRoot: '/workspace' })).rejects.toThrow('stopped');
    expect(provider.requestAssistantMessage).not.toHaveBeenCalled();
  });

  it('loads only trusted profile instructions and lets profiles narrow read tools', async () => {
    const seen: Array<{ messages: ChatMessage[]; tools: AgentToolDefinition[] }> = [];
    const provider = {
      requestAssistantMessage: vi.fn(async (_settings: unknown, messages: ChatMessage[], tools: AgentToolDefinition[]) => {
        seen.push({ messages, tools });
        return { role: 'assistant' as const, content: 'Profile review complete.' };
      }),
    };
    const runner = new RunReadOnlySubagent(
      provider, { list: async () => [readTool, listTool] }, { execute: async () => ({ ok: true, output: '' }) }, settings,
      { evaluate: async () => ({ allowed: true, requiresApproval: false }) }, undefined,
      { load: async () => ({ id: 'profile-1', name: 'strict-reviewer', instructions: 'Check every claim.', allowedTools: ['read_file'] }) },
    );
    const result = await runner.run({ prompt: 'Review', role: 'review', agentId: 'profile-1', workspaceRoot: '/workspace' });
    expect(result).toMatchObject({ agentId: 'profile-1', content: 'Profile review complete.' });
    expect(seen[0].tools.map((tool) => tool.name)).toEqual(['read_file']);
    expect(String(seen[0].messages[0].content)).toContain('Check every claim.');
  });
});

function sequenceProvider(responses: AssistantResponse[], seenTools: string[][] = []) {
  let index = 0;
  return {
    requestAssistantMessage: vi.fn(async (_settings: unknown, _messages: ChatMessage[], tools: AgentToolDefinition[]) => {
      seenTools.push(tools.map((tool) => tool.name));
      return responses[index++];
    }),
  };
}
