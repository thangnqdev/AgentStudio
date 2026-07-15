# ADR 0009: Session-scoped model-facing task supervisor

## Status

Accepted.

## Context

Durable agent tasks represent whole conversations and their checkpoints. They cannot also represent the model's internal work breakdown without mixing session persistence, UI recovery, and dependency-graph concerns in one entity.

The researched reference behavior exposes task create/get/list/update operations, monotonic IDs, status transitions, ownership, metadata, dependency edges, and task lifecycle hooks. AgentStudio needs equivalent coordination behavior without writing repository metadata into the user's workspace or bypassing the central tool path.

## Decision

AgentStudio introduces `AgentWorkItem` as a separate domain entity and exposes it through `task_create`, `task_get`, `task_list`, and `task_update`.

Each board is keyed by the validated chat-thread ID so follow-up turns share task state; non-UI callers fall back to the durable agent-task identity. The infrastructure repository hashes that identity into a private Electron `userData/agent-work-items` filename, validates a bounded versioned document, rejects symlink traversal, and replaces the document atomically with owner-only permissions. A high-water `nextId` is retained after deletion.

The application use-case serializes mutations per board. Dependencies are stored in both `blocks` and `blockedBy`, validated after every mutation, and rejected if they are missing, self-referential, inconsistent, or cyclic. Deletion removes both sides of every edge. Listing filters completed task IDs from unresolved blockers but retrieval preserves the complete graph.

Task mutations are session-local application state, do not touch the workspace, do not execute code, and do not access the network. Under the existing four-value risk taxonomy they use the non-approval `read` class, but mutation tools are intentionally not concurrency-safe. Read-only subagents do not receive these tools.

`TaskCreated` runs before a new board is saved. `TaskCompleted` runs before the status transition is applied. A matching declarative `block_task` action or an unreadable hook policy fails closed and leaves the previous board unchanged. Hook audit records include bounded task identity but exclude task descriptions and metadata.

## Consequences

- Fresh chat threads have isolated boards; follow-up turns and resumed work in the same thread recover the same board.
- Task state never appears as untracked workspace files.
- Model-facing coordination goes through the same validation, event presentation, audit, tracing, cancellation, and permission pipeline as other tools.
- Cross-process team claiming and mailbox delivery remain separate future capabilities; this board is synchronized within the Electron main process only.
