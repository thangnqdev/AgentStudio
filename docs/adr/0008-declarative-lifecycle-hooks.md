# ADR 0008: Declarative lifecycle hooks before executable plugins

## Status

Accepted.

## Context

The researched Claude Code sourcemap exposes a broad lifecycle vocabulary and persisted hook types for commands, prompts, HTTP requests, and agent verification. Copying that execution model directly would create new shell, network, credential, and model paths around AgentStudio's central permission policy. Repository-owned configuration can change after checkout and must be treated as untrusted influence.

## Decision

AgentStudio adopts the lifecycle event vocabulary as a domain contract. It integrates `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `TaskCreated`, and `TaskCompleted`. Unsupported events are rejected instead of silently appearing active.

Workspace configuration is loaded from `.agentstudio/hooks.json` with a versioned, strictly bounded schema. The only actions are:

- `add_context`: add provenance-marked workspace guidance at supported context events;
- `deny_tool`: tighten `PreToolUse` policy;
- `require_approval`: force `PreToolUse` through the existing approval gateway;
- `block_task`: reject a matching `TaskCreated` or `TaskCompleted` transition without persisting it;
- `audit`: attach a bounded label to the sanitized hook audit record.

There is intentionally no `allow`, command, JavaScript, prompt-model, or HTTP action. Restrictive tool actions are also projected into the central workspace permission source, preserving the same policy for root and read-only subagent execution. `deny` continues to outrank `ask` and explicit hook policy can still restrict `danger-full-access`.

Hook files are read without following symlinks, capped at 128 KiB, limited to 100 definitions and 10 actions per definition, and validated before use. Invalid configuration fails closed before a tool runs or a task lifecycle transition is committed. Task matchers inspect only the bounded task subject. The audit log stores event, hook IDs, labels, timestamp, request/tool/task identity, and a hash of the workspace path; it excludes context, prompts, task descriptions, tool arguments, output, credentials, and raw paths.

Local plugin bundles are discovered under Electron `userData/plugins/*` and workspace `.agentstudio/plugins/*`, with metadata at `.claude-plugin/plugin.json`. A plugin identity hashes its resolved root, manifest bytes, and every declarative hook source. User preferences bind trust and enablement to that identity, so any active-content edit creates a different untrusted plugin. Enabling performs a second parse/hash check; runtime loading checks it again.

The manifest catalog reports hooks, skills, agents, commands, and MCP server components, but only hooks are activated in this phase. Other components remain informational and cannot bypass their dedicated trust/configuration flows.

## Consequences

- Teams gain useful lifecycle policy and context composition without creating a second executor.
- The full event list is visible for compatibility planning, but unsupported events still produce a clear configuration error.
- Executable plugin hooks remain deferred until there is explicit user trust bound to content hashes, process isolation, allow-listed environment variables, bounded output/time, cancellation, and a UI that shows the exact capabilities being granted.
- Future plugin composition of skills, agent profiles, and MCP definitions must reuse their existing trust and permission gates rather than treating plugin trust as a blanket capability grant.
