# Changelog

All notable changes to AgentStudio are documented in this file.

## [0.4.0] - 2026-07-18

### Added

- A responsive live multi-agent control center with a unified roster, status metrics, agent inspector, approval and stop controls, worktree/result visibility, and Activity/Mailbox views.
- Process-isolated persistent workers, authenticated team messaging, durable tasks/mailboxes, recovery checkpoints, and bounded nested-agent execution.
- Web fetch, LSP, notebook, MCP resource/authentication, cron, remote-trigger, IDE-context, and deferred-tool-search capabilities behind the shared permission and audit boundary.
- Secure picker-authorized chat attachments, bounded chat history, background-command sidecars and completion notices, and manual context compaction.
- Expanded slash-command UX for model, permissions, resume, rename, context, status, hooks, and compaction workflows.
- Declarative lifecycle hooks across session, tool, permission, subagent, team, worktree, file-change, background-command, compaction, and model lifecycle events.

### Changed

- OpenAI-compatible streaming now normalizes fragmented content, tool calls, usage, and cache metrics across bounded SSE chunks.
- GitHub tag releases now generate release notes from the repository history before publishing the Windows artifacts.

### Security

- Child agents run with filtered environments and cannot exceed inherited permission, sandbox, plan, tool, or workspace authority.
- Attachment, MCP, remote-network, path, and process operations use validated capabilities and main-process-owned policy enforcement.

[0.4.0]: https://github.com/thangnqdev/AgentStudio/releases/tag/v0.4.0
