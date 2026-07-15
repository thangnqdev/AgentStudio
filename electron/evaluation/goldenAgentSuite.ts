import type { GoldenRuntimeSuiteDefinition, GoldenTaskSuite } from '../domain/entities/agentEvaluation.js';

const BASE_EXPECTATIONS = {
  taskStatus: 'completed' as const,
  testsMustPass: false,
  maxFailedToolCalls: 0,
  relevantChunkIds: [],
};

export const GOLDEN_AGENT_RUNTIME_SUITE: GoldenRuntimeSuiteDefinition = {
  id: 'agent-studio-runtime-golden', version: '2.4.0', minimumAggregateScore: 0.95,
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
      id: 'foreground-agent-delegation', version: '1.0.0',
      expected: {
        ...BASE_EXPECTATIONS,
        tools: ['Agent', 'read_file'],
        forbiddenTools: ['write_file', 'apply_patch', 'run_command'],
        changedFiles: [],
        maxSteps: 3,
      },
      runtime: {
        prompt: 'Delegate a focused read-only architecture review to a named agent, then report its evidence.',
        permissionMode: 'danger-full-access',
        initialFiles: [{ path: 'docs/architecture.md', content: '# Boundary\n\nDomain imports no infrastructure modules.\n' }],
        assertedFiles: [],
        responses: [
          { toolCalls: [{ name: 'Agent', args: {
            description: 'Review architecture boundary', prompt: 'Read docs/architecture.md and return the exact dependency boundary.',
            name: 'architecture-reviewer', mode: 'read-only', run_in_background: false,
          } }] },
          { content: 'The delegated reviewer confirmed that domain imports no infrastructure modules.' },
        ],
        workerResponses: [
          { toolCalls: [{ name: 'read_file', args: { path: 'docs/architecture.md' } }] },
          { content: 'Evidence: docs/architecture.md states that domain imports no infrastructure modules.' },
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
    {
      id: 'background-command-lifecycle', version: '1.0.0',
      expected: {
        ...BASE_EXPECTATIONS,
        tools: ['run_command', 'task_output'],
        forbiddenTools: ['write_file', 'apply_patch', 'task_stop'],
        changedFiles: [],
        maxSteps: 3,
      },
      runtime: {
        prompt: 'Run a short command in the background, wait for it, read its output, and report only after it completes.',
        permissionMode: 'danger-full-access',
        initialFiles: [],
        assertedFiles: [],
        responses: [
          { toolCalls: [{ name: 'run_command', args: {
            command: 'node -e "process.stdout.write(\'background-eval-ready\')"',
            description: 'Emit background evaluation marker',
            run_in_background: true,
            timeoutMs: 5_000,
          } }] },
          { toolCalls: [{ name: 'task_output', args: { task_id: 'bg-runtime-eval', block: true, timeoutMs: 5_000 } }] },
          { content: 'The background command completed and emitted background-eval-ready.' },
        ],
      },
    },
    {
      id: 'interactive-plan-lifecycle', version: '1.0.0',
      expected: {
        ...BASE_EXPECTATIONS,
        tools: ['EnterPlanMode', 'read_file', 'AskUserQuestion', 'ExitPlanMode'],
        forbiddenTools: ['write_file', 'apply_patch', 'run_command'],
        changedFiles: [],
        maxSteps: 4,
      },
      runtime: {
        prompt: 'Enter plan mode, inspect the architecture, clarify the adapter choice, and present a plan for approval before coding.',
        permissionMode: 'danger-full-access',
        initialFiles: [{ path: 'docs/architecture.md', content: '# Architecture\n\nUse ports between application and infrastructure.\n' }],
        assertedFiles: [],
        interactions: [
          { accepted: true },
          { accepted: true, answers: { 'Which adapter boundary should the plan use?': 'Explicit port' } },
          { accepted: true },
        ],
        responses: [
          { toolCalls: [{ name: 'EnterPlanMode', args: {} }] },
          { toolCalls: [{ name: 'read_file', args: { path: 'docs/architecture.md' } }] },
          { toolCalls: [{ name: 'AskUserQuestion', args: { questions: [{
            question: 'Which adapter boundary should the plan use?', header: 'Boundary',
            options: [
              { label: 'Explicit port', description: 'Keep application independent.' },
              { label: 'Direct import', description: 'Couple application to infrastructure.' },
            ],
            multiSelect: false,
          }] } }] },
          { toolCalls: [{ name: 'ExitPlanMode', args: { plan: '# Plan\n\n1. Define a port.\n2. Implement the infrastructure adapter.\n3. Add tests.' } }] },
          { content: 'The plan was approved; implementation can now begin.' },
        ],
      },
    },
    {
      id: 'isolated-worktree-lifecycle', version: '1.0.0',
      expected: {
        ...BASE_EXPECTATIONS,
        tools: ['EnterWorktree', 'write_file', 'ExitWorktree'],
        forbiddenTools: ['apply_patch', 'run_command'],
        changedFiles: [],
        testsMustPass: true,
        maxSteps: 3,
      },
      runtime: {
        prompt: 'Explicitly enter an isolated worktree, create proof.txt there, then keep and exit the worktree. Do not change the original workspace.',
        permissionMode: 'danger-full-access',
        initialFiles: [{ path: 'original.txt', content: 'original workspace remains unchanged\n' }],
        assertedFiles: [{ path: 'original.txt', content: 'original workspace remains unchanged\n' }],
        responses: [
          { toolCalls: [
            { name: 'EnterWorktree', args: { name: 'evaluation/isolation' } },
            { name: 'write_file', args: { path: 'proof.txt', content: 'isolated change\n' } },
          ] },
          { toolCalls: [{ name: 'ExitWorktree', args: { action: 'keep' } }] },
          { content: 'The isolated change was preserved in its worktree and the original workspace stayed unchanged.' },
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
