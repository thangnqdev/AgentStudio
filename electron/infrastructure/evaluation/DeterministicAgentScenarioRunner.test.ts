import { describe, expect, it } from 'vitest';
import { createDefaultAgentEvaluators } from '../../application/services/agentEvaluators.js';
import { BuildGoldenAgentRuntimeSuite } from '../../application/usecases/BuildGoldenAgentRuntimeSuite.js';
import { RunAgentEvaluationRegression } from '../../application/usecases/RunAgentEvaluationRegression.js';
import { GOLDEN_AGENT_RUNTIME_SUITE } from '../../evaluation/goldenAgentSuite.js';
import { DeterministicAgentScenarioRunner } from './DeterministicAgentScenarioRunner.js';
import { DEFAULT_OPTIMIZATION_CONFIG } from '../../domain/entities/optimizer.js';

describe('DeterministicAgentScenarioRunner', () => {
  it('runs the real session, permission, approval and filesystem tool path', async () => {
    const observed = await new DeterministicAgentScenarioRunner().run(GOLDEN_AGENT_RUNTIME_SUITE.fixtures[0], DEFAULT_OPTIMIZATION_CONFIG);

    expect(observed.taskStatus).toBe('completed');
    expect(observed.completedSteps).toBe(2);
    expect(observed.toolCalls).toEqual([
      { toolName: 'read_file', outcome: 'succeeded' },
      { toolName: 'apply_patch', outcome: 'succeeded' },
    ]);
    expect(observed.changedFiles).toEqual(['src/example.ts']);
    expect(observed.testsPassed).toBe(true);
    expect(observed.policyViolationCodes).toEqual([]);
  });

  it('keeps a read-only research workspace unchanged', async () => {
    const observed = await new DeterministicAgentScenarioRunner().run(GOLDEN_AGENT_RUNTIME_SUITE.fixtures[1], DEFAULT_OPTIMIZATION_CONFIG);

    expect(observed.taskStatus).toBe('completed');
    expect(observed.toolCalls).toEqual([{ toolName: 'read_file', outcome: 'succeeded' }]);
    expect(observed.changedFiles).toEqual([]);
    expect(observed.policyViolationCodes).toEqual([]);
  });

  it('derives retrieval evidence from the production lexical ranker', async () => {
    const observed = await new DeterministicAgentScenarioRunner().run(GOLDEN_AGENT_RUNTIME_SUITE.fixtures[2], DEFAULT_OPTIMIZATION_CONFIG);

    expect(observed.taskStatus).toBe('completed');
    expect(observed.retrievedChunkIds).toEqual(['chunk-domain-boundary']);
    expect(observed.toolCalls).toEqual([]);
    expect(observed.changedFiles).toEqual([]);
  });

  it('runs the production task supervisor composition without workspace changes', async () => {
    const observed = await new DeterministicAgentScenarioRunner().run(GOLDEN_AGENT_RUNTIME_SUITE.fixtures[3], DEFAULT_OPTIMIZATION_CONFIG);

    expect(observed.taskStatus).toBe('completed');
    expect(observed.completedSteps).toBe(5);
    expect(observed.toolCalls).toEqual([
      { toolName: 'task_create', outcome: 'succeeded' },
      { toolName: 'task_create', outcome: 'succeeded' },
      { toolName: 'task_update', outcome: 'succeeded' },
      { toolName: 'task_update', outcome: 'succeeded' },
      { toolName: 'task_list', outcome: 'succeeded' },
    ]);
    expect(observed.changedFiles).toEqual([]);
    expect(observed.policyViolationCodes).toEqual([]);
  });

  it('fails the report when a real patch execution regresses', async () => {
    const definition = structuredClone(GOLDEN_AGENT_RUNTIME_SUITE);
    definition.fixtures = [definition.fixtures[0]];
    definition.fixtures[0].runtime.responses[1] = {
      toolCalls: [{ name: 'apply_patch', args: { path: 'src/example.ts', oldText: 'missing text', newText: 'export const answer = 42;' } }],
    };
    const suite = await new BuildGoldenAgentRuntimeSuite(new DeterministicAgentScenarioRunner()).execute(definition, DEFAULT_OPTIMIZATION_CONFIG);
    const regression = new RunAgentEvaluationRegression(createDefaultAgentEvaluators(), {
      append: async () => undefined,
      list: async () => [],
      exportJson: async () => undefined,
    });

    expect(suite.fixtures[0].observed.toolCalls[1].outcome).toBe('failed');
    expect(suite.fixtures[0].observed.changedFiles).toEqual([]);
    expect((await regression.execute(suite, DEFAULT_OPTIMIZATION_CONFIG)).passed).toBe(false);
  });

  it('keeps same-turn writes isolated after entering a managed worktree', async () => {
    const observed = await new DeterministicAgentScenarioRunner().run(GOLDEN_AGENT_RUNTIME_SUITE.fixtures[6], DEFAULT_OPTIMIZATION_CONFIG);

    expect(observed.taskStatus).toBe('completed');
    expect(observed.toolCalls).toEqual([
      { toolName: 'EnterWorktree', outcome: 'succeeded' },
      { toolName: 'write_file', outcome: 'succeeded' },
      { toolName: 'ExitWorktree', outcome: 'succeeded' },
    ]);
    expect(observed.changedFiles).toEqual([]);
    expect(observed.testsPassed).toBe(true);
    expect(observed.policyViolationCodes).toEqual([]);
  });
});
