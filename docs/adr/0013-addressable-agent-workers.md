# ADR 0013: Addressable agent workers and messaging

## Status

Accepted.

## Context

The reference client does not treat delegation as a single model call. Its `Agent` tool creates an independently addressable runtime with foreground/background lifecycle, a stable ID, transcript continuation, message delivery at tool-round boundaries, completion notifications, permission inheritance, and optional worktree isolation. `SendMessage` can redirect a running worker or resume a stopped worker from its transcript. AgentStudio's legacy `delegate_task` was intentionally read-only, synchronous, limited to eight steps, and therefore could not provide these invariants.

A background worker may outlive the renderer request that created it. Reusing only the parent chat's stream callbacks would silently lose approvals, progress, and completion after that request ends. A prompt convention or background command wrapper cannot repair that lifecycle boundary.

## Decision

AgentStudio adds the exact `Agent` and `SendMessage` tool names while retaining `delegate_task` as a compatibility alias. `Agent` accepts the reference fields `description`, `prompt`, `subagent_type`, `model`, `run_in_background`, `name`, `team_name`, `mode`, `isolation`, and `cwd`. Input is strict and bounded. `cwd` must resolve to a real absolute directory, stays inside the workspace except in `danger-full-access`, and cannot be combined with worktree isolation. A child permission mode may only equal or reduce its parent's authority.

`ManageAgentWorkers` owns stable worker identities, active abort controllers, foreground/background execution, name lookup, continuation, notification delivery, and a maximum nesting depth of three. Nested workers may use `Agent` synchronously but cannot create another background worker. The production child session uses the same model loop, tool validation, central permission policy, lifecycle hooks, audit, tracing, filesystem tools, commands, MCP, web search, task supervisor, and background command supervisor as the root session. Trusted `subagent_type` profiles contribute instructions and may reduce the tool catalog.

`PrivateAgentWorkerRepository` stores each transcript and pending-message queue below Electron `userData/agent-workers` using hashed filenames, owner-only permissions, bounded files, atomic replacement, and serialized mutations. Completion notifications are stored separately by hashed parent scope. Interrupted running workers recover as paused; they are never falsely reported as completed. Provider settings and API keys are not persisted with worker records.

Plain `SendMessage` input requires a five-to-ten-word preview. A message to a running worker is persisted and drained into the conversation at the next completed tool round. A message to a completed, failed, paused, or killed worker appends to the saved transcript and resumes it in the background. Broadcast is scoped to the current parent conversation. Structured shutdown and approval-response shapes are validated; team-wide shutdown handshakes remain part of the subsequent team-runtime milestone.

Background actions use the worker ID as their approval request ID. A long-lived renderer subscription displays worker status and pending approvals independently of the parent chat stream, and a dedicated validated IPC path responds to those approvals. Root sessions drain durable completion notifications before the first model turn and after later tool rounds. Thus a completion that arrives after the parent response is still delivered on the next turn rather than lost.

`isolation: "worktree"` composes with the existing managed worktree gateway under a worker-specific scope. A clean completed worktree is removed automatically. A changed worktree is kept and its path and branch are returned. Paused workers retain their managed session for continuation.

The deterministic golden runtime now executes a real foreground `Agent` call with a separate scripted child model and verifies the child `read_file` trajectory. Integration tests also exercise full-capability isolated edits, same-turn message injection, background notification, transcript resume, repository privacy, and interrupted recovery.

## Consequences

- Delegation is now a supervised runtime rather than a bounded read-only helper call.
- Background workers can continue after the spawning chat request finishes without losing approval or completion state.
- Child tools cannot use delegation to escalate permission, escape a workspace path, bypass audit, or bypass hooks.
- Worker transcripts and messages are sent to the configured provider when executed or resumed; users must not place unrelated secrets in delegated prompts.
- Worker processes remain in-process and are stopped when Electron quits; persisted transcripts support later continuation, not process resurrection.
- `TeamCreate`, `TeamDelete`, team membership, shared mailbox protocol, task claiming, and graceful multi-member shutdown are still required for complete team parity.
