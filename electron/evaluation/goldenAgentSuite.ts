import type { GoldenRuntimeSuiteDefinition, GoldenTaskSuite } from '../domain/entities/agentEvaluation.js';

const BASE_EXPECTATIONS = {
  taskStatus: 'completed' as const,
  testsMustPass: false,
  maxFailedToolCalls: 0,
  relevantChunkIds: [],
};

const NOTEBOOK_BEFORE = {
  cells: [{ cell_type: 'code', id: 'calc', source: 'answer = 41', metadata: {}, execution_count: 1, outputs: [{ output_type: 'stream', text: '41' }] }],
  metadata: { language_info: { name: 'python' } }, nbformat: 4, nbformat_minor: 5,
};
const NOTEBOOK_AFTER = {
  ...NOTEBOOK_BEFORE,
  cells: [{ cell_type: 'code', id: 'calc', source: 'answer = 42', metadata: {}, execution_count: null, outputs: [] }],
};

export const GOLDEN_AGENT_RUNTIME_SUITE: GoldenRuntimeSuiteDefinition = {
  id: 'agent-studio-runtime-golden', version: '4.0.0', minimumAggregateScore: 0.95,
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
      id: 'team-agent-coordination', version: '2.0.0',
      expected: {
        ...BASE_EXPECTATIONS,
        tools: ['ToolSearch', 'TeamCreate', 'read_file', 'Agent'],
        forbiddenTools: ['write_file', 'apply_patch', 'run_command'],
        changedFiles: [],
        maxSteps: 4,
      },
      runtime: {
        prompt: 'Create a review team, launch a named teammate to inspect the architecture boundary, then report the delegation.',
        permissionMode: 'danger-full-access',
        initialFiles: [{ path: 'docs/architecture.md', content: '# Boundary\n\nDomain imports no infrastructure modules.\n' }],
        assertedFiles: [],
        responses: [
          { toolCalls: [{ name: 'ToolSearch', args: { query: 'select:TeamCreate' } }] },
          { toolCalls: [{ name: 'TeamCreate', args: { team_name: 'architecture-team', description: 'Review architecture boundaries.' } }] },
          { toolCalls: [{ name: 'Agent', args: {
            description: 'Review architecture boundary', prompt: 'Read docs/architecture.md and report the dependency boundary.',
            name: 'reviewer', team_name: 'architecture-team', mode: 'read-only',
          } }] },
          { content: 'The architecture review was delegated to reviewer in architecture-team.' },
        ],
        workerResponses: [
          { toolCalls: [{ name: 'read_file', args: { path: 'docs/architecture.md' } }] },
          { content: 'The domain layer imports no infrastructure modules.' },
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
      id: 'task-supervisor-dependencies', version: '3.0.0',
      expected: {
        ...BASE_EXPECTATIONS,
        tools: ['ToolSearch', 'TaskCreate', 'TaskUpdate', 'TaskList'],
        forbiddenTools: ['run_command', 'write_file', 'apply_patch'],
        changedFiles: [],
        maxSteps: 6,
      },
      runtime: {
        prompt: 'Create implementation and verification tasks, make verification depend on implementation, complete implementation, then list the remaining work.',
        permissionMode: 'read-only',
        initialFiles: [],
        assertedFiles: [],
        responses: [
          { toolCalls: [{ name: 'ToolSearch', args: { query: 'select:TaskCreate,TaskUpdate,TaskList' } }] },
          { toolCalls: [{ name: 'TaskCreate', args: { subject: 'Implement feature', description: 'Build the requested behavior.' } }] },
          { toolCalls: [{ name: 'TaskCreate', args: { subject: 'Verify feature', description: 'Run the verification checks.' } }] },
          { toolCalls: [{ name: 'TaskUpdate', args: { taskId: '2', addBlockedBy: ['1'] } }] },
          { toolCalls: [{ name: 'TaskUpdate', args: { taskId: '1', status: 'completed' } }] },
          { toolCalls: [{ name: 'TaskList', args: {} }] },
          { content: 'Implementation is complete and verification is the next unblocked task.' },
        ],
      },
    },
    {
      id: 'background-command-lifecycle', version: '2.0.0',
      expected: {
        ...BASE_EXPECTATIONS,
        tools: ['ToolSearch', 'run_command', 'TaskOutput'],
        forbiddenTools: ['write_file', 'apply_patch', 'TaskStop'],
        changedFiles: [],
        maxSteps: 4,
      },
      runtime: {
        prompt: 'Run a short command in the background, wait for it, read its output, and report only after it completes.',
        permissionMode: 'danger-full-access',
        initialFiles: [],
        assertedFiles: [],
        responses: [
          { toolCalls: [{ name: 'ToolSearch', args: { query: 'select:TaskOutput' } }] },
          { toolCalls: [{ name: 'run_command', args: {
            command: 'node -e "process.stdout.write(\'background-eval-ready\')"',
            description: 'Emit background evaluation marker',
            run_in_background: true,
            timeoutMs: 5_000,
          } }] },
          { toolCalls: [{ name: 'TaskOutput', args: { task_id: 'bg-runtime-eval', block: true, timeout: 5_000 } }] },
          { content: 'The background command completed and emitted background-eval-ready.' },
        ],
      },
    },
    {
      id: 'interactive-plan-lifecycle', version: '2.0.0',
      expected: {
        ...BASE_EXPECTATIONS,
        tools: ['ToolSearch', 'EnterPlanMode', 'read_file', 'AskUserQuestion', 'ExitPlanMode'],
        forbiddenTools: ['write_file', 'apply_patch', 'run_command'],
        changedFiles: [],
        maxSteps: 5,
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
          { toolCalls: [{ name: 'ToolSearch', args: { query: 'select:EnterPlanMode,AskUserQuestion,ExitPlanMode' } }] },
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
      id: 'deferred-web-fetch', version: '1.0.0',
      expected: {
        ...BASE_EXPECTATIONS,
        tools: ['ToolSearch', 'WebFetch'],
        forbiddenTools: ['web_search', 'run_command', 'write_file', 'apply_patch'],
        changedFiles: [],
        maxSteps: 2,
      },
      runtime: {
        prompt: 'Load the URL fetch tool, read the supplied Python documentation page, and report the Path invariant without changing files.',
        permissionMode: 'read-only',
        initialFiles: [],
        assertedFiles: [],
        webPages: [{
          url: 'https://docs.python.org/3/library/pathlib.html',
          content: '# pathlib.Path\n\nPath objects provide an object-oriented interface for filesystem paths.\n',
        }],
        responses: [
          { toolCalls: [{ name: 'ToolSearch', args: { query: 'select:WebFetch' } }] },
          { toolCalls: [{ name: 'WebFetch', args: {
            url: 'https://docs.python.org/3/library/pathlib.html',
            prompt: 'State the documented Path invariant.',
          } }] },
          { content: 'Path provides an object-oriented interface for filesystem paths.' },
        ],
      },
    },
    {
      id: 'notebook-cell-edit', version: '1.0.0',
      expected: {
        ...BASE_EXPECTATIONS,
        tools: ['ToolSearch', 'read_file', 'NotebookEdit'],
        forbiddenTools: ['write_file', 'apply_patch', 'run_command'],
        changedFiles: ['analysis.ipynb'],
        maxSteps: 3,
      },
      runtime: {
        prompt: 'Load notebook editing, read analysis.ipynb, replace cell calc with answer = 42, and preserve notebook validity.',
        permissionMode: 'danger-full-access',
        initialFiles: [{ path: 'analysis.ipynb', content: JSON.stringify(NOTEBOOK_BEFORE) }],
        assertedFiles: [{ path: 'analysis.ipynb', content: JSON.stringify(NOTEBOOK_AFTER, null, 1) }],
        webPages: [],
        responses: [
          { toolCalls: [{ name: 'ToolSearch', args: { query: 'select:NotebookEdit' } }] },
          { toolCalls: [{ name: 'read_file', args: { path: 'analysis.ipynb' } }] },
          { toolCalls: [{ name: 'NotebookEdit', args: {
            notebook_path: 'analysis.ipynb', cell_id: 'calc', new_source: 'answer = 42', edit_mode: 'replace',
          } }] },
          { content: 'Updated notebook cell calc and cleared stale execution output.' },
        ],
      },
    },
    {
      id: 'isolated-worktree-lifecycle', version: '2.0.0',
      expected: {
        ...BASE_EXPECTATIONS,
        tools: ['ToolSearch', 'EnterWorktree', 'write_file', 'ExitWorktree'],
        forbiddenTools: ['apply_patch', 'run_command'],
        changedFiles: [],
        testsMustPass: true,
        maxSteps: 4,
      },
      runtime: {
        prompt: 'Explicitly enter an isolated worktree, create proof.txt there, then keep and exit the worktree. Do not change the original workspace.',
        permissionMode: 'danger-full-access',
        initialFiles: [{ path: 'original.txt', content: 'original workspace remains unchanged\n' }],
        assertedFiles: [{ path: 'original.txt', content: 'original workspace remains unchanged\n' }],
        responses: [
          { toolCalls: [{ name: 'ToolSearch', args: { query: 'select:EnterWorktree,ExitWorktree' } }] },
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
