# ADR 0019: MCP IDE selection context

## Status

Accepted.

## Context

The reference client recognizes one connected MCP server named `ide`, listens for its custom
`selection_changed` and `at_mentioned` notifications, and adds selected lines, the currently opened
file, or an explicitly mentioned file range to the next root prompt. AgentStudio already supports
MCP and LSP but previously had no equivalent bridge from an external editor's current context into
the model loop.

MCP notifications are external input. Treating every server as an IDE or forwarding arbitrary
selection text without normal file-read policy would create an automatic prompt-injection and data
egress path outside the central permission boundary.

## Decision

Only a connected MCP server whose configured name normalizes to `ide` can publish these events.
The selection parser requires a bounded path/text and a valid zero-based half-open range. The
at-mention parser requires a bounded path and an optional ordered zero-based range. Public line
numbers are one-based; unknown or malformed notifications are ignored.

The latest connected-IDE value is snapshotted on the first model step of each root request, so a
selection remains stable throughout that request while a later user turn sees the newest editor
state. It is not propagated to child workers. Before formatting, AgentStudio canonicalizes the
workspace and selected path, rejects paths outside that workspace, and evaluates the canonical
`read_file` tool under the request's permission mode and active workspace/user/hook rules. An
`ask` or `deny` outcome omits the context; ambient context never opens an approval side channel.

Selected text is capped at 2,000 characters, XML-escaped, labelled as untrusted code/data rather
than instructions, and described as potentially unrelated. An empty selection contributes only
the relative opened-file path. At-mentions are queued at a maximum of ten, consumed by the next
root request, and then retained only in that request's stable snapshot. Their regular files are
opened without following symlinks, capped by the shared 200 KB text limit, sliced to the requested
range, escaped, and bounded to 12,000 characters each and 24,000 aggregate IDE-context characters.
The existing composite ambient source keeps passive LSP diagnostics and IDE context independent.

## Consequences

- Users can connect a compatible VS Code, Cursor, Windsurf, or JetBrains MCP bridge under the name
  `ide` and have explicit editor context reach the root agent.
- Ordinary MCP servers cannot silently become IDE context providers.
- Workspace and permission rules remain authoritative even though the file text originated in an
  MCP notification rather than a local `read_file` call.
- IDE diff-tab control, connection onboarding, and an in-renderer selection indicator remain
  separate client-integration work.
