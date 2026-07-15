# AgentStudio — Architect AI

An **Electron + React + TypeScript** desktop application for AI-powered coding agent sessions.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 43 |
| UI Framework | React 19 + TypeScript 6 |
| Build tool | Vite 8 + vite-plugin-electron |
| Styling | TailwindCSS v4 |
| State management | Zustand 5 |
| Icons | Material Symbols Outlined |
| Fonts | Inter, JetBrains Mono, Newsreader |
| Linting | Oxlint |

## Getting Started

```bash
# Install dependencies
npm install

# Start in development mode (Electron + Vite HMR)
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Unit tests
npm test
```

## Phát hành & tự cập nhật

Bản cài Windows dùng NSIS và kiểm tra bản phát hành mới trên GitHub Releases. Khi có bản mới,
người dùng đã cài app sẽ thấy nút **Cập nhật**, tự chọn tải xuống, rồi bấm **Cài & khởi động lại**.

Để phát hành một bản mới:

```bash
# 1. Tăng version (bắt buộc: updater chỉ nhận version cao hơn)
npm version patch

# 2. Đẩy commit và tag v* lên GitHub
git push origin master --follow-tags
```

Workflow `.github/workflows/release.yml` sẽ build Windows installer, tạo GitHub Release và tải
lên file cài đặt cùng `latest.yml`. Có thể tạo bản phát hành cục bộ với `npm run release` khi
đã đặt biến môi trường `GH_TOKEN`. Release repository phải công khai; nếu dùng repository riêng,
người dùng cuối không thể nhận update mà không có cơ chế xác thực riêng.

## Knowledge Indexing

- Knowledge sources can be added individually or synchronized from the current workspace for the running app session.
- Workspace sync indexes supported text and code files, ignores dependency/build directories, and excludes `.env` and common key/certificate files.
- TypeScript, TSX, JavaScript, and JSX sources are chunked by AST symbols; unsupported languages retain the text chunking fallback.
- Documents persist their chunking version and embedding profile. Changing the embedding endpoint or model requires reindexing rather than mixing incompatible vectors.

### Vector Storage Gate

The current JSON store remains appropriate for small knowledge bases. Move to a vector database only after the evaluation corpus shows unacceptable retrieval latency or recall at the intended chunk count. The migration must retain SQLite-or-equivalent metadata, a benchmark suite, index-version migration, and Electron packaging tests; ANN alone is not a quality improvement.

### Knowledge Evaluation Harness

- Generate reviewable, chunk-anchored candidate queries with `npm run eval:knowledge -- generate <knowledge-store.json> <dataset.json>`.
- After reviewing `cases[].relevantChunkIds`, run the benchmark with `npm run eval:knowledge -- run <dataset.json> <report.json>`.
- Reports include Recall@k, Precision@k, MRR, nDCG, per-case misses, and mean/p50/p95/p99 latency. Generated cases are candidates, not trusted ground truth until reviewed.

## Tool Platform

- Local tools are registered from one typed catalog, shared by the model schema and execution policy.
- `glob` finds files recursively and `grep` returns bounded `path:line` evidence. Both skip dependency/build trees, do not follow symlinks, support cancellation, and remain subject to path-scoped permission rules.
- Read-only tools run automatically. In `workspace-write`, file writes and shell commands require explicit per-action approval and remain workspace-scoped/sandboxed. In `danger-full-access`, tools run automatically by default, commands are unsandboxed, and absolute file paths are allowed; explicit central `ask`/`deny` rules still take precedence.
- Tool audit records persist locally as JSONL with a hashed workspace identifier. File contents and tool arguments are not written to that audit log.
- `apply_patch` performs one exact, unambiguous replacement so edits do not need to resend a complete file.

### Provider & Model Configuration

- **Lưu provider** persists the connection and a newline/comma-separated manual model list without requiring a network request.
- **Lưu & quét model** explicitly queries the provider catalog. A scan failure no longer prevents users from saving a manual provider configuration.
- When the renderer is opened outside Electron or preload fails, the app shows a dedicated bridge diagnostic instead of reporting the issue as a provider/model error.

### Permission Rules

- Workspace rules live in `.agentstudio/permissions.json` and may only tighten policy with `ask` or `deny`.
- User rules live under Electron `userData/permissions/rules.json` and may use `allow`, `ask`, or `deny`.
- Precedence is `deny` → `ask` → `allow`; `deny` also overrides `danger-full-access`, while no rule can weaken `read-only`.
- Rules require `effect` and `toolGlob`; optional constraints are `risk`, `pathGlob`, and `commandPrefix`. Globs support `*` and `?`.

```json
{
  "rules": [
    { "id": "deny-delete", "effect": "deny", "toolGlob": "run_command", "commandPrefix": "rm " },
    { "id": "ask-secrets", "effect": "ask", "toolGlob": "read_file", "pathGlob": "config/*" }
  ]
}
```

### Agent Skills

- Skills are discovered from app `userData/skills`, `~/.agents/skills`, `.agents/skills`, and `.agent/skills`.
- A skill must have valid YAML-frontmatter `SKILL.md`, and must be explicitly trusted and enabled in Settings before its instructions can enter the agent prompt.
- Skill `allowed-tools` metadata never bypasses the central tool policy. Skill scripts are not executed automatically.

### Project Instructions

- Every fresh or resumed session loads bounded workspace-root guidance from `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, and `.claude/CLAUDE.local.md`.
- Instruction files are read without following symlinks and enter both root-agent and read-only-subagent prompts with their source labels.
- Project text is workspace-authored guidance: it cannot grant permissions, authorize data egress, reveal credentials, or override the central tool policy.

### Declarative Lifecycle Hooks

- Workspace hooks live in `.agentstudio/hooks.json`. AgentStudio executes `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `TaskCreated`, and `TaskCompleted`; unsupported lifecycle events are rejected instead of silently appearing active.
- Hook actions are deliberately capability-free: `add_context`, `deny_tool`, `require_approval`, `block_task`, and `audit`. `block_task` is valid only for task lifecycle events and rolls back creation/completion. There is no hook action that grants a permission, executes a shell command, invokes a model, or sends an HTTP request.
- `PreToolUse` restrictions are translated into workspace permission rules, so they also apply to read-only subagents. A malformed hook file fails closed before tool execution.
- Hook files are bounded, cannot be symlinks, and are read only from the current workspace. Applied hook identities and labels are written to a private JSONL audit file without hook context, tool arguments, output, or the raw workspace path.

```json
{
  "version": 1,
  "hooks": {
    "SessionStart": [
      {
        "id": "project-checks",
        "actions": [{ "type": "add_context", "content": "Run focused tests before the full gate." }]
      }
    ],
    "PreToolUse": [
      {
        "id": "review-shell",
        "matcher": "run_*",
        "actions": [
          { "type": "require_approval", "reason": "Review every shell command." },
          { "type": "audit", "label": "shell-review" }
        ]
      }
    ],
    "TaskCompleted": [
      {
        "id": "require-verification",
        "matcher": "*release*",
        "actions": [{ "type": "block_task", "reason": "Verify the release before closing this task." }]
      }
    ]
  }
}
```

- Architecture decision and security boundary: [`docs/adr/0008-declarative-lifecycle-hooks.md`](docs/adr/0008-declarative-lifecycle-hooks.md).

### Declarative Plugins

- AgentStudio discovers local plugin bundles from Electron `userData/plugins/*` and `.agentstudio/plugins/*`. Each bundle uses the familiar `.claude-plugin/plugin.json` manifest location.
- A plugin receives a content-bound identity derived from its root, manifest, and hook files. It must be explicitly trusted and enabled in **Settings → Declarative Plugins**; changing any active hook content produces a new untrusted identity.
- The catalog reports `skills`, `agents`, `commands`, and `mcpServers` declared by a manifest, but this phase activates only declarative hooks. Other components remain visible as unsupported instead of being executed through a side door.
- Persisted Claude-style command, prompt-model, HTTP, and agent hooks are rejected. Existing skill, agent-profile, and MCP trust gates remain authoritative.

```json
{
  "name": "strict-review-pack",
  "version": "1.0.0",
  "description": "Workspace review policy",
  "hooks": "hooks/hooks.json"
}
```

The external hook file may use `{ "hooks": { ... } }` or AgentStudio's versioned `{ "version": 1, "hooks": { ... } }` envelope.

### Durable Agent Tasks

- Running tasks checkpoint to an append-only JSONL journal. Restart recovery pauses interrupted tasks, a torn final record is repaired before the next append, and oversized journals compact atomically.
- A paused or failed task can resume in place, or continue on an independent branch. A branch preserves the source context and conversation, records `parentTaskId` lineage, receives a fresh trace and step budget, and never mutates the source task.
- Running tasks cannot be forked because their latest in-memory tool/model state may not yet be durable. Branch depth is bounded at 20.

### Model-facing Task Supervisor

- The model can use `task_create`, `task_get`, `task_list`, and `task_update` to track non-trivial work, ownership, status, metadata, and dependency edges. Dependency updates are atomic and two-way; self-dependencies and cycles are rejected.
- Each task board is scoped to the chat-thread ID, with a durable agent-task fallback for non-UI callers. Follow-up turns in one chat share the board, while a new chat starts clean. Boards live in private Electron `userData` storage under hashed filenames and never create files in the workspace.
- IDs increase monotonically even after deletion. Deleting a task removes every inbound and outbound dependency; `task_list` hides blockers that are already completed.
- Task mutations do not touch the workspace and therefore do not require file-write approval. They are still serialized, strictly validated, size-bounded, lifecycle-hooked, and audited through the existing agent tool path.
- Architecture decision: [`docs/adr/0009-model-facing-task-supervisor.md`](docs/adr/0009-model-facing-task-supervisor.md).

### Read-only Subagents

- The root model can use `delegate_task` for bounded `explore`, `review`, or `plan` work. Delegation is classified as network risk and therefore follows the same central approval rules as every other tool.
- Each subagent gets at most eight model steps, a 12,000-character task prompt, a 40,000-character final result, and only the local `list_files`, `read_file`, `glob`, `grep`, and `load_skill` tools.
- Subagents always run in `read-only`, cannot delegate recursively, and cannot open an interactive approval prompt. A matching `ask` or `deny` rule blocks the child tool call rather than weakening policy.
- Custom profiles are discovered from `userData/agents`, `~/.agents/agents`, `.agents/agents`, `.agent/agents`, and `.claude/agents`. Both user and workspace profiles require explicit trust and enablement in **Agent Profiles**.
- Profile identity is bound to a content hash. Editing metadata or instructions creates a new untrusted identity, and a second hash check at load time closes the discover/load race.

```md
---
name: strict-reviewer
description: Review correctness and cite file evidence
tools: [list_files, read_file]
---
Check assumptions, identify concrete failure modes, and clearly label uncertainty.
```

- Architecture decision and invariants: [`docs/adr/0007-bounded-subagents-and-profiles.md`](docs/adr/0007-bounded-subagents-and-profiles.md).

### MCP Servers

- MCP servers are added only through Settings; models, repository files, and skills cannot register or launch servers.
- stdio servers use command/argument arrays without a shell and receive only the MCP SDK safe environment plus explicitly configured encrypted environment credentials.
- Streamable HTTP requires HTTPS except on localhost. Static bearer tokens and OAuth 2 client-credentials authentication are supported; secrets use Electron `safeStorage` when available.
- Server tool metadata and output are marked untrusted. Each server receives a local default risk classification, and all MCP calls pass through the same approval and audit pipeline as local tools.
- Lifecycle controls include start, stop, auto-start, connection status, error reporting, pagination-aware tool discovery, request timeout, and shutdown cleanup.

## Unified Observability

- Every durable agent task owns one stable `traceId` that survives pause, failure recovery, and resume.
- Typed spans cover model calls, tool calls, retrieval, approvals, checkpoints, and versioned evaluations. Tool and approval spans retain task/step/parent linkage without storing arguments or output.
- OpenAI-compatible streaming requests ask for usage metadata and persist only bounded input/output/total/cached token counts. Providers that reject `stream_options` are retried once without it; arbitrary model prices are never guessed, so USD remains unknown until explicit pricing is configured.
- Traces are append-only JSONL under Electron `userData/observability`; files use owner-only permissions where supported.
- The **Quan sát agent** view lists local trajectories, displays sanitized span metadata, and exports a selected trace as JSONL.
- Prompts, chat content, retrieval queries/results, tool arguments/output, API keys, credentials, workspace paths, and provider URLs are not part of the trace schema and are rejected by runtime validation.
- Architecture decision and invariants: [`docs/adr/0001-unified-observability.md`](docs/adr/0001-unified-observability.md).

## Agent-wide Evaluation

- `npm run eval:agent -- [report.json]` runs a versioned deterministic runtime suite and exits non-zero when aggregate or dimension thresholds regress.
- The suite uses a scripted local model without network/API cost, but runs the production session loop, permission/approval path, filesystem tools, checkpoints, tracing and lexical retrieval against isolated temporary workspaces. Observations are collected from runtime state and disk, not embedded as passing fixture results.
- It grades task outcome, tool selection, code-change scope/assertions, policy violations, trajectory efficiency and knowledge retrieval in one report. This is a runtime contract regression, not a benchmark of live-model reasoning quality.
- Retrieval evaluation reuses the existing Recall@k, reciprocal-rank and nDCG implementation rather than defining a second metric path.
- Evaluators receive a deep-cloned, frozen fixture and have no task repository, tool executor or policy mutation capability. Every score includes fixture/evaluator provenance and semantic versions.
- Reports persist as owner-only JSONL under Electron `userData/evaluations`; the **Đánh giá agent** view can run the golden suite and export a selected report.
- New reports use schema v2 and persist the exact runtime optimizer snapshot plus a canonical digest. Legacy v1 reports remain readable but cannot authorize optimizer promotion.
- Architecture decision and invariants: [`docs/adr/0002-agent-wide-evaluation.md`](docs/adr/0002-agent-wide-evaluation.md).

## Workflow Runtime

- Versioned DAG workflows support sequence, equality-based branch, bounded retry, durable approval and parallel read-only action nodes.
- Each transition persists a `NodeCheckpoint`; paused approval runs resume from the same node and do not replay successful predecessors.
- Parallel children are rejected unless every child is a uniquely owned `read` action. Cycles, unbounded retries, arbitrary expressions and parallel writes are rejected by domain validation.
- The built-in **Local Agent Readiness** workflow checks workspace/provider/knowledge state, demonstrates parallel reads and pauses for explicit approval without changing tool permissions.
- The **Workflows** view starts runs, displays node executions and submits approve/deny decisions through typed IPC.
- Architecture decision and invariants: [`docs/adr/0003-workflow-runtime.md`](docs/adr/0003-workflow-runtime.md).

## Capability Registry

- Local tools, connected MCP tools, knowledge retrieval, trusted skills, web search and PTY terminal appear in one typed, read-only inventory.
- Each snapshot reports availability, risk, explicit cost confidence, sample count, success rate, mean/p95 latency and categorized failures derived from sanitized traces.
- The **Capabilities** view shows the inventory and advisory ranking. Recommendations contain no tool arguments, executor access or permission mutation; execution still passes through the existing central policy.
- Unknown metrics and costs remain `null`/`unknown` instead of being treated as zero.
- Architecture decision and invariants: [`docs/adr/0004-capability-registry.md`](docs/adr/0004-capability-registry.md).

## Safe Optimizer

- The active tuning snapshot is limited to retrieval top-K/weights, an allow-listed model, context budget, bounded workflow retry count, command timeout and skill-ranking weight.
- Candidates are immutable snapshots tied to an active revision. **Evaluate** automatically runs the same versioned suite once with the active snapshot and once with the candidate snapshot.
- The evaluator requires each report's exact config snapshot and canonical digest to match the expected baseline/candidate. Manually paired, legacy, stale, or mismatched reports cannot authorize promotion.
- Promotion requires a strict measured improvement; ties, failed reports and stale candidates are rejected. Every promotion retains the previous full snapshot for rollback.
- Runtime consumers read the active snapshot for retrieval, context compaction, model selection, workflow retry, command timeout and skill ranking. Optimizer state contains no permission, approval, credential, command or path fields.
- Architecture decision and invariants: [`docs/adr/0005-safe-optimizer.md`](docs/adr/0005-safe-optimizer.md).

## Signed Skill Learning

- A succeeded sanitized trace can produce one candidate playbook from successful tool names/order only. Prompts, file content, arguments, outputs, paths and retrieved text are not available to the generator.
- Every candidate includes versioned generated tests. The capability-free evaluator has no model, tool, network, filesystem or policy port and cannot mutate the candidate snapshot.
- Evaluation does not imply approval. The **Skill Learning** view requires an explicit local-user approve/reject action before promotion becomes available.
- Promotion writes only to Electron `userData/skills`, signs the exact versioned `SKILL.md` with an owner-only local key, and stores a signature manifest. The catalog rejects a tampered learned skill.
- Promoted skills still enter the existing trust/enable workflow and never bypass central tool policy. Source files and production runtime code are never edited by learning.
- Architecture decision and invariants: [`docs/adr/0006-signed-skill-learning.md`](docs/adr/0006-signed-skill-learning.md).

## Project Structure

```
AgentStudio/
├── electron/
│   ├── domain/         # Entities and ports
│   ├── application/    # Use-cases and orchestration
│   ├── infrastructure/ # Filesystem, providers, tools, persistence
│   ├── ipc/            # Thin validated controllers
│   ├── main.ts         # Composition/bootstrap
│   └── preload.ts      # Narrow context bridge
├── src/
│   ├── domain/         # Renderer-side entities and pure rules
│   ├── application/    # Hooks and UI orchestration
│   ├── infrastructure/ # Typed IPC adapters
│   ├── components/     # React UI components
│   ├── store/          # Zustand UI state slices
│   ├── App.tsx
│   └── index.css       # TailwindCSS v4 design tokens
└── public/
```

## Architecture

- **State**: Composed Zustand slices manage renderer UI state; durable tasks, settings, traces and policies remain in main-process repositories/use-cases.
- **Routing**: Simple state-based view switching via `activeView` in the store (no external router needed).
- **IPC**: Narrow APIs are exposed through `contextBridge`; renderer components call application hooks/adapters, and validated main-process controllers delegate to use-cases.
