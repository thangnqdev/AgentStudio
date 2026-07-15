# ADR 0015: Deferred tool search runtime

## Status

Accepted.

## Context

The reference client keeps `ToolSearch` available while withholding complete schemas for MCP tools and selected built-ins. Sending every schema on every request wastes context and makes a growing MCP catalog increasingly expensive. Returning search results without changing the next request would be cosmetic: the model must receive the selected schemas on its following turn, and that selection must survive durable task resume and local context compaction.

Tool metadata is dynamic because MCP servers may connect, disconnect, or change their catalog during a session. Search input and schema output are also untrusted bounded data. Tool discovery must not bypass the normal permission, approval, hook, audit, or execution path.

## Decision

AgentStudio always offers the exact `ToolSearch` name. MCP tools are deferred automatically; built-ins opt in with `deferLoading`, while `alwaysLoad` can exempt a tool. The initial model catalog exposes non-deferred tools, `ToolSearch`, and only the names of unavailable deferred tools. Full parameters are returned after a successful search inside a bounded `<functions>` envelope.

`select:ToolName,OtherTool` performs case-insensitive direct selection and ignores unknown names. Bare exact names succeed even for non-deferred or already loaded tools. Keyword search scores normalized names, descriptions, search hints, required `+terms`, and MCP prefixes, with a small MCP relevance preference. Input is strict and limited to 1,000 characters and 20 results; output is limited to 100,000 characters. A schema too large to fit is not marked loaded.

`ToolSearchPlatform` decorates the existing catalog, executor, and workspace scope. It never executes a selected tool itself. Loaded calls continue through the same platform chain and therefore retain central policy, approval, lifecycle hooks, tracing, audit, worktree routing, and MCP trust boundaries. It re-reads the underlying catalog for every list/search/execute operation so newly connected MCP tools are discoverable.

`RunAgentSession` takes a fresh catalog snapshot before every model request. Therefore a successful search changes the callable schemas on the next model turn. Search output is recorded in the normal durable agent step. When a root task or worker is reconstructed, only validated tool names from successful bounded result envelopes are restored. Local conversation projection or compaction does not discard the durable message record.

The root session, durable workers, and deterministic evaluation runtime use the decorator. The legacy bounded read-only `delegate_task` runner remains intentionally limited to its five fixed local read tools and does not use dynamic/MCP schemas.

## Consequences

- Large and changing MCP catalogs no longer force all parameter schemas into every request.
- Deferred schemas become callable only on the model turn after a successful search.
- Loaded-tool state survives checkpoint resume without a second persistence format.
- Selecting a tool never grants permission to execute it.
- The golden runtime suite now exercises search-before-use for team, task, background, plan, and worktree tools.
- `WebFetch`, LSP, notebook editing, MCP resources/auth, and exact compatibility aliases remain separate parity milestones.
