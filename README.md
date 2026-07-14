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
- Read-only tools run automatically. In `workspace-write`, file writes and shell commands require explicit per-action approval and remain workspace-scoped/sandboxed. In `danger-full-access`, tools run automatically by default, commands are unsandboxed, and absolute file paths are allowed; explicit central `ask`/`deny` rules still take precedence.
- Tool audit records persist locally as JSONL with a hashed workspace identifier. File contents and tool arguments are not written to that audit log.
- `apply_patch` performs one exact, unambiguous replacement so edits do not need to resend a complete file.

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

### Durable Agent Tasks

- Running tasks checkpoint to an append-only JSONL journal. Restart recovery pauses interrupted tasks, a torn final record is repaired before the next append, and oversized journals compact atomically.
- A paused or failed task can resume in place, or continue on an independent branch. A branch preserves the source context and conversation, records `parentTaskId` lineage, receives a fresh trace and step budget, and never mutates the source task.
- Running tasks cannot be forked because their latest in-memory tool/model state may not yet be durable. Branch depth is bounded at 20.

### Read-only Subagents

- The root model can use `delegate_task` for bounded `explore`, `review`, or `plan` work. Delegation is classified as network risk and therefore follows the same central approval rules as every other tool.
- Each subagent gets at most eight model steps, a 12,000-character task prompt, a 40,000-character final result, and only the local `list_files`, `read_file`, and `load_skill` tools.
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
- Traces are append-only JSONL under Electron `userData/observability`; files use owner-only permissions where supported.
- The **Quan sát agent** view lists local trajectories, displays sanitized span metadata, and exports a selected trace as JSONL.
- Prompts, chat content, retrieval queries/results, tool arguments/output, API keys, credentials, workspace paths, and provider URLs are not part of the trace schema and are rejected by runtime validation.
- Architecture decision and invariants: [`docs/adr/0001-unified-observability.md`](docs/adr/0001-unified-observability.md).

## Agent-wide Evaluation

- `npm run eval:agent -- [report.json]` runs the versioned golden suite and exits non-zero when aggregate or dimension thresholds regress.
- The suite grades task outcome, tool selection, code-change scope/tests, policy violations, trajectory efficiency and knowledge retrieval in one report.
- Retrieval evaluation reuses the existing Recall@k, reciprocal-rank and nDCG implementation rather than defining a second metric path.
- Evaluators receive a deep-cloned, frozen fixture and have no task repository, tool executor or policy mutation capability. Every score includes fixture/evaluator provenance and semantic versions.
- Reports persist as owner-only JSONL under Electron `userData/evaluations`; the **Đánh giá agent** view can run the golden suite and export a selected report.
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
- Candidates are immutable snapshots tied to an active revision. Evaluation compares two passing reports from the same versioned agent suite and records their IDs, scores, evaluator version and configuration digest.
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
│   ├── main.ts        # Electron main process
│   └── preload.ts     # Context bridge (IPC)
├── src/
│   ├── components/    # React UI components
│   ├── store/         # Zustand global state
│   ├── App.tsx
│   └── index.css      # TailwindCSS v4 design tokens
└── public/
```

## Architecture

- **State**: Zustand store in `src/store/useAppStore.ts` manages messages, active task, project path, and active view.
- **Routing**: Simple state-based view switching via `activeView` in the store (no external router needed).
- **IPC**: Electron IPC channels exposed via `contextBridge` in `preload.ts`. Main process handles `ping` and `fs:read` channels.
