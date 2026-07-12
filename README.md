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
- Read-only tools run automatically. In `workspace-write`, file writes and shell commands require explicit per-action approval and remain workspace-scoped/sandboxed. In `danger-full-access`, all tools run automatically without manual approval, commands are unsandboxed, and absolute file paths are allowed.
- Tool audit records persist locally as JSONL with a hashed workspace identifier. File contents and tool arguments are not written to that audit log.
- `apply_patch` performs one exact, unambiguous replacement so edits do not need to resend a complete file.

### Agent Skills

- Skills are discovered from app `userData/skills`, `~/.agents/skills`, `.agents/skills`, and `.agent/skills`.
- A skill must have valid YAML-frontmatter `SKILL.md`, and must be explicitly trusted and enabled in Settings before its instructions can enter the agent prompt.
- Skill `allowed-tools` metadata never bypasses the central tool policy. Skill scripts are not executed automatically.

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
