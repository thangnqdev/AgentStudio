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

## Knowledge Indexing

- Knowledge sources can be added individually or synchronized from the current workspace for the running app session.
- Workspace sync indexes supported text and code files, ignores dependency/build directories, and excludes `.env` and common key/certificate files.
- TypeScript, TSX, JavaScript, and JSX sources are chunked by AST symbols; unsupported languages retain the text chunking fallback.
- Documents persist their chunking version and embedding profile. Changing the embedding endpoint or model requires reindexing rather than mixing incompatible vectors.

### Vector Storage Gate

The current JSON store remains appropriate for small knowledge bases. Move to a vector database only after the evaluation corpus shows unacceptable retrieval latency or recall at the intended chunk count. The migration must retain SQLite-or-equivalent metadata, a benchmark suite, index-version migration, and Electron packaging tests; ANN alone is not a quality improvement.

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
