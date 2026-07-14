import { describe, expect, it, vi } from 'vitest';
import type { GoldenTaskFixture } from '../../domain/entities/agentEvaluation.js';
import { GOLDEN_AGENT_RUNTIME_SUITE } from '../../evaluation/goldenAgentSuite.js';
import { BuildGoldenAgentRuntimeSuite } from './BuildGoldenAgentRuntimeSuite.js';

describe('BuildGoldenAgentRuntimeSuite', () => {
  it('replaces declared scenarios with freshly observed runtime evidence', async () => {
    const observed: GoldenTaskFixture['observed'] = {
      taskId: 'runtime-task', traceId: 'runtime-trace', taskStatus: 'completed', completedSteps: 1,
      toolCalls: [{ toolName: 'read_file', outcome: 'succeeded' }], changedFiles: [], testsPassed: false,
      policyViolationCodes: [], retrievedChunkIds: [],
    };
    const run = vi.fn(async () => observed);
    const definition = { ...GOLDEN_AGENT_RUNTIME_SUITE, fixtures: [GOLDEN_AGENT_RUNTIME_SUITE.fixtures[1]] };
    const suite = await new BuildGoldenAgentRuntimeSuite({ run }).execute(definition);

    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(definition.fixtures[0]);
    expect(suite.fixtures[0].observed).toEqual(observed);
    expect('runtime' in suite.fixtures[0]).toBe(false);
  });
});
