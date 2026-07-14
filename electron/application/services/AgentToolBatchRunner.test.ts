import { describe, expect, it } from 'vitest';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import { AgentToolBatchRunner, partitionRunnableTools } from './AgentToolBatchRunner.js';

function call(id: string, name: string) {
  return { id, function: { name, arguments: '{}' } };
}

const readTool: AgentToolDefinition = { name: 'read_file', description: 'read', risk: 'read', concurrencySafe: true, parameters: {} };
const writeTool: AgentToolDefinition = { name: 'write_file', description: 'write', risk: 'write', parameters: {} };

describe('AgentToolBatchRunner', () => {
  it('partitions only consecutive explicitly safe read tools', () => {
    const groups = partitionRunnableTools([
      { call: call('1', 'read_file'), definition: readTool },
      { call: call('2', 'read_file'), definition: readTool },
      { call: call('3', 'write_file'), definition: writeTool },
      { call: call('4', 'read_file'), definition: readTool },
    ]);
    expect(groups.map((group) => [group.concurrent, group.items.map((item) => item.call.id)])).toEqual([
      [true, ['1', '2']], [false, ['3']], [true, ['4']],
    ]);
  });

  it('runs safe reads concurrently and preserves model order in returned results', async () => {
    let active = 0;
    let maximumActive = 0;
    const runner = { run: async (input: { toolCall: ReturnType<typeof call> }) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, input.toolCall.id === '1' ? 10 : 1));
      active -= 1;
      return { stepContent: input.toolCall.id, toolMessage: { role: 'tool' as const, tool_call_id: input.toolCall.id, content: input.toolCall.id } };
    } };
    const batch = new AgentToolBatchRunner(runner as never, 2);
    const results = await batch.run({
      eventSink: { emitChunk: () => undefined, emitAction: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      permissionMode: 'workspace-write', requestId: 'request', step: 0, workspaceRoot: '/workspace',
      toolCalls: [call('1', 'read_file'), call('2', 'read_file')],
      toolsByName: new Map([['read_file', readTool]]),
    });
    expect(maximumActive).toBe(2);
    expect(results.map((result) => result.stepContent)).toEqual(['1', '2']);
  });
});
