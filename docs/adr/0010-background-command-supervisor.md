# ADR 0010: Session-scoped background command supervisor

## Status

Accepted.

## Context

AgentStudio's original `run_command` path collected all output in memory and terminated every command after at most 30 seconds. That model cannot support long builds, servers, watchers, or other work that must continue while the model performs independent steps.

The researched reference behavior separates model work items from executable background tasks. A shell call can return a task identity immediately; a read-only task-output tool can wait or poll; and a stop tool can terminate the process tree. Output is file-backed, bounded, and retrieved independently from the workspace.

## Decision

`run_command` accepts `run_in_background=true` (plus a camel-case compatibility alias). The application-layer `BackgroundCommandToolPlatform` intercepts that form and exposes `task_output` and `task_stop`. Foreground execution still delegates to the existing executor. All three operations therefore continue through the central schema validation, permission, approval, lifecycle-hook, audit, trace, and UI-action path.

Each background task belongs to the validated chat-thread scope. A task ID from one thread cannot read or stop a task from another thread. The main-process supervisor retains tasks across follow-up turns for the lifetime of the app; task IDs are unguessable in production.

Follow-up requests reconstruct bounded historical function-call/result pairs from the persisted chat actions. This preserves the provider protocol and lets the model reuse an exact task ID instead of rerunning the command. Raw historical arguments are deliberately not reconstructed because the renderer stores only a display-safe summary; historical outputs are validated, size-bounded, and projected through the existing provider-context limits.

Foreground and background processes resolve through the same platform-specific command specification. They share the environment allowlist, macOS Seatbelt profile, Linux bubblewrap arguments, Windows fail-closed behavior, and process-tree termination helper. No user-controlled value is interpolated into a host-side `exec` call.

Output is streamed to an owner-only file below Electron `userData/background-command-output`. Creation uses exclusive, no-follow file opening where supported; reads also reject final-component symlinks. Model-visible retrieval is limited to the latest 100,000 bytes, while a 5GB disk guard terminates runaway producers. Per-command execution and output waits are independently bounded at ten minutes. Timeout, output-limit, non-zero exit, explicit stop, and spawn failure produce distinct terminal evidence.

`task_output` is read risk and can be used in read-only mode. Starting and stopping a command are execute risk: they remain blocked in read-only mode, require approval in workspace-write mode unless a stricter/explicit rule decides otherwise, and execute automatically only in danger-full-access when no central rule tightens policy.

## Consequences

- Long-running commands no longer consume the foreground tool timeout or force the model to wait blindly.
- A follow-up turn in the same chat can inspect or stop the command; unrelated chats cannot.
- Closing the Electron app signals every retained process tree and schedules force-kill fallback.
- Background processes are not restored after an app restart. Durable process reattachment and unsolicited completion-message injection remain separate parity work.
