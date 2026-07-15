# ADR 0014: Persistent agent team runtime

## Status

Accepted.

## Context

The reference client composes `TeamCreate`, `TeamDelete`, named `Agent` workers, `SendMessage`, and the task supervisor into one coordination runtime. A team has one leader, a flat roster, one shared task list, durable mailboxes, idle/resume behavior, and a correlated graceful-shutdown handshake. Implementing only the tool names would leave workers on separate task lists and make team messages, ownership changes, or shutdown responses unreliable.

AgentStudio workers already have durable transcripts and may survive across chat turns and application restarts. Team state therefore cannot be renderer-only or tied to one streaming request. It must preserve the existing permission, approval, audit, worktree, lifecycle-hook, and provider boundaries.

## Decision

AgentStudio exposes the exact `TeamCreate` and `TeamDelete` tool names. Input is strict and bounded. One chat scope may lead one team, and a globally conflicting team name receives a stable numeric suffix. Team names remain human-readable and are never used as filesystem paths; private storage is addressed by a SHA-256 digest of the chat scope.

`ManageAgentTeams` owns team creation/deletion, flat membership, teammate name allocation, message routing, task assignment delivery, and graceful shutdown state. With an active team, a named `Agent` becomes a teammate even when `run_in_background` is false; team workers always run asynchronously. Teammates cannot create/delete teams or spawn additional named teammates, but the existing bounded synchronous unnamed subagent path remains available.

Each team receives one unguessable shared task-list identity. Root and teammate task platforms resolve that identity dynamically. Moving an unowned task to `in_progress` auto-claims it for the current teammate. Owner changes create a `task_assignment` mailbox entry and wake the assigned teammate through the normal persisted worker queue.

Plain `SendMessage` retains the five-to-ten-word summary rule. Team broadcasts exclude the sender and deliver one bounded message per recipient. `shutdown_request` creates a random request ID before delivery; only the targeted teammate may send the matching response to `team-lead`. Approval stops the responder through the existing graceful worker path, while rejection requires a reason. Plan-approval responses are leader-to-teammate only.

`PrivateAgentTeamRepository` stores a versioned bounded record below Electron `userData/agent-teams`, with hashed filenames, owner-only permissions, atomic replacement, symlink checks, and serialized scope mutations. Full mailbox content and shutdown records never cross IPC. Renderer views contain roster state, counts, and bounded message metadata only. Interrupted workers recover as paused before an initial team view is returned, so the UI never reports a crashed worker as active.

Team state intentionally persists across application restart, unlike the reference client's session-end cleanup. This matches AgentStudio's resumable transcripts. `TeamDelete` requires every teammate to be non-running, removes the team record and shared task list, and preserves worker transcripts plus changed worktrees for audit/recovery. Clean worker worktrees are already removed by the worker lifecycle.

The deterministic runtime suite executes production `TeamCreate`, named team `Agent`, and a child `read_file` call with a separate scripted provider. Unit and integration tests cover unique teammate names, private persistence, shared task resolution, auto-claim, assignment delivery, mailbox redaction, shutdown correlation, deletion guards, and restart-safe views.

## Consequences

- Teams are durable coordination state rather than a prompt convention.
- Every teammate uses the full production worker runtime without gaining authority beyond the parent.
- Team status and mailbox metadata remain visible after the parent stream finishes through a typed long-lived event path.
- Changed worktrees and transcripts are not destructively removed by team cleanup.
- Cross-process teammate transport, Unix-domain socket bridges, permission-request mailbox messages, and richer peer-DM summaries remain separate parity milestones.
