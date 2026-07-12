import type { GoldenTaskSuite } from '../domain/entities/agentEvaluation.js';

export const GOLDEN_AGENT_SUITE: GoldenTaskSuite = {
  id: 'agent-studio-golden', version: '1.0.0', minimumAggregateScore: 0.95,
  minimumScores: { task: 1, tool_selection: 1, code_change: 1, policy: 1, trajectory: 1, retrieval: 1 },
  fixtures: [
    {
      id: 'read-and-patch', version: '1.0.0',
      expected: { taskStatus: 'completed', tools: ['read_file', 'apply_patch'], forbiddenTools: ['write_file'], changedFiles: ['src/example.ts'], testsMustPass: true, maxSteps: 6, maxFailedToolCalls: 0, relevantChunkIds: ['chunk-example'] },
      observed: { taskId: 'golden-task-1', traceId: 'golden-trace-1', taskStatus: 'completed', completedSteps: 2, toolCalls: [{ toolName: 'read_file', outcome: 'succeeded' }, { toolName: 'apply_patch', outcome: 'succeeded' }], changedFiles: ['src/example.ts'], testsPassed: true, policyViolationCodes: [], retrievedChunkIds: ['chunk-example'] },
    },
    {
      id: 'read-only-research', version: '1.0.0',
      expected: { taskStatus: 'completed', tools: ['read_file'], forbiddenTools: ['run_command', 'write_file'], changedFiles: [], testsMustPass: false, maxSteps: 4, maxFailedToolCalls: 0, relevantChunkIds: ['chunk-architecture'] },
      observed: { taskId: 'golden-task-2', traceId: 'golden-trace-2', taskStatus: 'completed', completedSteps: 1, toolCalls: [{ toolName: 'read_file', outcome: 'succeeded' }], changedFiles: [], testsPassed: false, policyViolationCodes: [], retrievedChunkIds: ['chunk-architecture'] },
    },
  ],
};
