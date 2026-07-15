# ADR 0012: Managed agent worktrees

## Status

Accepted.

## Context

The reference client exposes `EnterWorktree` and `ExitWorktree` as session-scoped tools. Their core value is stronger than creating a Git branch: after entry, every local operation must use the isolated checkout, the state must survive follow-up turns and app restarts, and removal must never destroy unverified work. A prompt-only convention cannot enforce these properties because filesystem tools, commands, hooks, skills, permissions, tasks, and subagents resolve their roots at different runtime boundaries.

## Decision

AgentStudio exposes the exact `EnterWorktree` and `ExitWorktree` tool names only to the root agent. Input is strictly bounded: names contain at most 64 characters in safe slash-separated segments, callers cannot choose an arbitrary path, and exit accepts only `keep` or `remove` plus an explicit `discard_changes` boolean.

`ManageAgentWorktrees` owns one active worktree per chat scope. The chat-thread ID is preferred as the scope, with durable task ID and request ID fallbacks. A private session record below Electron `userData/agent-worktree-sessions` stores the original root, Git common directory, managed path, branch, baseline commit, and creation time under a hashed owner-only filename. Restore activates a record only when the original workspace and Git ownership can be reverified.

`GitAgentWorktreeGateway` creates checkouts below `userData/managed-worktrees/<repository-digest>` so the source repository is not polluted by an application directory. Git is invoked with `execFile`, argument arrays, a filtered environment, and disabled terminal prompting. Before inspection or removal, the gateway verifies all of the following: the checkout is a real directory below the configured private root, its top level is the recorded path, its branch matches, its Git common directory matches the source repository, and Git still registers the worktree.

The worktree platform is the outermost root-agent tool wrapper. Non-lifecycle calls receive the current managed root rather than the originally supplied root. The session loop also re-resolves that root before every tool, including tools in the same model response, so permission rules, approval context, lifecycle hooks, audit records, and execution cannot disagree. The system prompt is refreshed at each model step. Session preparation restores project instructions, knowledge, skills, profiles, and hooks from the active worktree while durable task identity remains tied to the original workspace.

`ExitWorktree` is fail-closed. `keep` exits the chat scope but preserves the checkout and branch. `remove` first inspects uncommitted files and commits since the baseline; without `discard_changes=true`, any change rejects removal. Unknown Git state also rejects removal. The model is instructed to set the discard flag only after explicit user confirmation. Successful state changes are emitted from the main process through a typed event, and the renderer displays the authoritative active-worktree banner without directly accessing Electron APIs.

The deterministic runtime suite uses a scripted worktree adapter and exercises `EnterWorktree` followed by a write in the same model response. It asserts that the original workspace remains byte-for-byte unchanged before exiting. Real-Git integration tests separately cover creation, dirty-state inspection, ownership verification, removal, and branch cleanup.

## Consequences

- File, command, hook, skill, task, subagent, permission, and audit boundaries agree on one current root.
- Follow-up turns and app restarts can safely resume an application-owned worktree after Git ownership verification.
- A dirty, committed, missing, moved, symlinked, or otherwise unverifiable checkout is never automatically deleted.
- `keep` deliberately relinquishes application ownership while leaving the checkout and branch available for manual work.
- The current implementation does not copy ignored files, run worktree setup hooks, mirror sparse-checkout settings, or create tmux sessions. These are optional reference-client conveniences, not part of the isolation and data-loss invariants implemented here.
