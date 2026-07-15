import type { GoldenRuntimeSuiteDefinition, GoldenTaskSuite } from '../domain/entities/agentEvaluation.js';

const BASE_EXPECTATIONS = {
  taskStatus: 'completed' as const,
  testsMustPass: false,
  maxFailedToolCalls: 0,
  relevantChunkIds: [],
};

export const GOLDEN_AGENT_RUNTIME_SUITE: GoldenRuntimeSuiteDefinition = {
  id: 'agent-studio-runtime-golden', version: '2.1.0', minimumAggregateScore: 0.95,
  minimumScores: { task: 1, tool_selection: 1, code_change: 1, policy: 1, trajectory: 1, retrieval: 1 },
  fixtures: [
    {
      id: 'read-and-patch', version: '2.0.0',
      expected: { ...BASE_EXPECTATIONS, tools: ['read_file', 'apply_patch'], forbiddenTools: ['write_file'], changedFiles: ['src/example.ts'], testsMustPass: true, maxSteps: 6 },
      runtime: {
        prompt: 'Read src/example.ts, update the exported answer from 41 to 42 with an exact patch, then finish.',
        permissionMode: 'workspace-write',
        initialFiles: [{ path: 'src/example.ts', content: 'export const answer = 41;\n' }],
        assertedFiles: [{ path: 'src/example.ts', content: 'export const answer = 42;\n' }],
        responses: [
          { toolCalls: [{ name: 'read_file', args: { path: 'src/example.ts' } }] },
          { toolCalls: [{ name: 'apply_patch', args: { path: 'src/example.ts', oldText: 'export const answer = 41;', newText: 'export const answer = 42;' } }] },
          { content: 'Updated src/example.ts and verified the expected content.' },
        ],
      },
    },
    {
      id: 'read-only-research', version: '2.0.0',
      expected: { ...BASE_EXPECTATIONS, tools: ['read_file'], forbiddenTools: ['run_command', 'write_file', 'apply_patch'], changedFiles: [], maxSteps: 4 },
      runtime: {
        prompt: 'Read docs/architecture.md and summarize the boundary without changing any file.',
        permissionMode: 'read-only',
        initialFiles: [{ path: 'docs/architecture.md', content: '# Architecture\n\nDomain code has no infrastructure dependencies.\n' }],
        assertedFiles: [],
        responses: [
          { toolCalls: [{ name: 'read_file', args: { path: 'docs/architecture.md' } }] },
          { content: 'The document keeps domain code independent from infrastructure.' },
        ],
      },
    },
    {
      id: 'knowledge-assisted-answer', version: '2.0.0',
      expected: { ...BASE_EXPECTATIONS, tools: [], forbiddenTools: ['run_command', 'write_file', 'apply_patch'], changedFiles: [], maxSteps: 2, relevantChunkIds: ['chunk-domain-boundary'] },
      runtime: {
        prompt: 'Which layer must remain independent from infrastructure dependencies?',
        permissionMode: 'read-only',
        initialFiles: [],
        assertedFiles: [],
        knowledge: {
          query: 'layer independent infrastructure dependencies', limit: 20,
          store: {
            version: 2,
            documents: [
              { id: 'doc-architecture', name: 'architecture.md', sourcePath: 'architecture.md', contentHash: 'fixture', addedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', size: 128, chunkCount: 2, indexingMode: 'lexical', indexVersion: 2, sourceKind: 'text' },
            ],
            chunks: [
              { id: 'chunk-domain-boundary', documentId: 'doc-architecture', ordinal: 0, content: 'The domain layer must remain independent from infrastructure dependencies.', section: 'Dependency boundary', tokenCount: 10, sourceKind: 'text' },
              { id: 'chunk-renderer-style', documentId: 'doc-architecture', ordinal: 1, content: 'Renderer spacing uses the shared design tokens.', section: 'Presentation', tokenCount: 8, sourceKind: 'text' },
            ],
          },
        },
        responses: [{ content: 'The domain layer must remain independent from infrastructure dependencies.' }],
      },
    },
    {
      id: 'task-supervisor-dependencies', version: '1.0.0',
      expected: {
        ...BASE_EXPECTATIONS,
        tools: ['task_create', 'task_update', 'task_list'],
        forbiddenTools: ['run_command', 'write_file', 'apply_patch'],
        changedFiles: [],
        maxSteps: 5,
      },
      runtime: {
        prompt: 'Create implementation and verification tasks, make verification depend on implementation, complete implementation, then list the remaining work.',
        permissionMode: 'read-only',
        initialFiles: [],
        assertedFiles: [],
        responses: [
          { toolCalls: [{ name: 'task_create', args: { subject: 'Implement feature', description: 'Build the requested behavior.' } }] },
          { toolCalls: [{ name: 'task_create', args: { subject: 'Verify feature', description: 'Run the verification checks.' } }] },
          { toolCalls: [{ name: 'task_update', args: { taskId: '2', addBlockedBy: ['1'] } }] },
          { toolCalls: [{ name: 'task_update', args: { taskId: '1', status: 'completed' } }] },
          { toolCalls: [{ name: 'task_list', args: {} }] },
          { content: 'Implementation is complete and verification is the next unblocked task.' },
        ],
      },
    },
  ],
};

/** Static observations are intentionally limited to evaluator unit tests. */
export const AGENT_EVALUATOR_FIXTURE_SUITE: GoldenTaskSuite = {
  id: 'agent-evaluator-fixtures', version: '1.0.0', minimumAggregateScore: 0.95,
  minimumScores: GOLDEN_AGENT_RUNTIME_SUITE.minimumScores,
  fixtures: [
    {
      id: 'evaluator-perfect-result', version: '1.0.0',
      expected: GOLDEN_AGENT_RUNTIME_SUITE.fixtures[0].expected,
      observed: {
        taskId: 'fixture-task', traceId: 'fixture-trace', taskStatus: 'completed', completedSteps: 2,
        toolCalls: [{ toolName: 'read_file', outcome: 'succeeded' }, { toolName: 'apply_patch', outcome: 'succeeded' }],
        changedFiles: ['src/example.ts'], testsPassed: true, policyViolationCodes: [], retrievedChunkIds: [],
      },
    },
  ],
};
