# ADR 0008: Declarative lifecycle hooks before executable plugins

## Status

Accepted.

## Context

The researched Claude Code sourcemap exposes a broad lifecycle vocabulary and persisted hook types for commands, prompts, HTTP requests, and agent verification. Copying that execution model directly would create new shell, network, credential, and model paths around AgentStudio's central permission policy. Repository-owned configuration can change after checkout and must be treated as untrusted influence.

## Decision

AgentStudio adopts the lifecycle event vocabulary as a domain contract. It integrates `InstructionsLoaded`, `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `PermissionDenied`, renderer `Notification`, `Elicitation`, `ElicitationResult`, `TaskCreated`, `TaskCompleted`, `SubagentStart`, `SubagentStop`, `TeammateIdle`, `WorktreeCreate`, `WorktreeRemove`, worktree-root `CwdChanged`, `ConfigChange`, successful local `FileChanged`, `PreCompact`/`PostCompact`, `Stop`, `StopFailure`, and `SessionEnd`. Unsupported events such as CLI-only `Setup` are rejected instead of silently appearing active.

Workspace configuration is loaded from `.agentstudio/hooks.json` with a versioned, strictly bounded schema. The only actions are:

- `add_context`: add provenance-marked workspace guidance at supported context events;
- `deny_tool`: tighten `PreToolUse` policy;
- `require_approval`: force `PreToolUse` through the existing approval gateway;
- `block_task`: reject a matching `TaskCreated` or `TaskCompleted` transition without persisting it;
- `audit`: attach a bounded label to the sanitized hook audit record.

There is intentionally no `allow`, command, JavaScript, prompt-model, or HTTP action. Restrictive tool actions are also projected into the central workspace permission source, preserving the same policy for root and read-only subagent execution. `deny` continues to outrank `ask` and explicit hook policy can still restrict `danger-full-access`.

The action matrix is deliberately narrower than the event vocabulary. Instruction-load, permission request/denial, notification, elicitation request/result, subagent start/stop, teammate-idle, worktree create/remove, cwd-change, config-change, file-change, compaction, model stop/failure and session-end hooks accept only `audit`; permission, notification, elicitation, subagent, teammate, worktree, cwd, config and file events may use bounded matchers. A `Notification` is dispatched only after a background-command completion toast is sent to a live renderer, using the bounded match value `background-command:<status>`; the internal workspace wrapper is never sent with the renderer notice. Application-layer decorators surround root sessions and worker runners so completion events fire on both success and failure without adding code to the size-bound model loop or worker manager. `Elicitation`/`ElicitationResult` bracket only `AskUserQuestion`, match the constant `questions`, and do not pass question or answer content into matching or audit. Instruction audit runs after bounded project guidance is loaded; `TeammateIdle` runs after authenticated protocol delivery and matches only the persisted teammate name; worktree/config audit runs only after persistence succeeds. `CwdChanged` follows a persisted worktree entry and the completed return to the original root; per-command cwd is not treated as a persistent session change. Successful application-owned write/edit/notebook mutations dispatch `FileChanged` with a workspace-relative path through a best-effort composite that also notifies LSP; shell, MCP and external mutations are not guessed. Compaction audit brackets attachment formatting and successful automatic conversation rebuilding after the pure compaction decision, and also brackets a manual main-owned reduction only after it is proven to remove old messages and reduce estimated context. Process-isolated workers may send only `PreCompact` or `PostCompact` through strictly parsed RPC; Electron main supplies the authoritative current workspace plus worker request/task identity and performs lookup/audit. Dispatch failure never changes an already determined approval, mutation, context rebuild, or session result.

Hook files are read without following symlinks, capped at 128 KiB, limited to 100 definitions and 10 actions per definition, and validated before use. Invalid configuration fails closed before a tool runs or a task lifecycle transition is committed. Task matchers inspect only the bounded task subject. The audit log stores event, hook IDs, labels, timestamp, request/tool/task identity, and a hash of the workspace path; it excludes context, prompts, task descriptions, tool arguments, output, credentials, and raw paths.

Local plugin bundles are discovered under Electron `userData/plugins/*` and workspace `.agentstudio/plugins/*`, with metadata at `.claude-plugin/plugin.json`. A plugin identity hashes its resolved root, manifest bytes, and every declarative hook source. User preferences bind trust and enablement to that identity, so any active-content edit creates a different untrusted plugin. Enabling performs a second parse/hash check; runtime loading checks it again.

The manifest catalog reports hooks, skills, agents, commands, and MCP server components, but only hooks are activated in this phase. Other components remain informational and cannot bypass their dedicated trust/configuration flows.

## Consequences

- Teams gain useful lifecycle policy and context composition without creating a second executor.
- The remaining event list is visible for compatibility planning, but unsupported events still produce a clear configuration error.
- Executable plugin hooks remain deferred until there is explicit user trust bound to content hashes, process isolation, allow-listed environment variables, bounded output/time, cancellation, and a UI that shows the exact capabilities being granted.
- Future plugin composition of skills, agent profiles, and MCP definitions must reuse their existing trust and permission gates rather than treating plugin trust as a blanket capability grant.
