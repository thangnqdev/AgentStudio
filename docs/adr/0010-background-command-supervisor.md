# ADR 0010: Session-scoped background command supervisor

## Status

Accepted.

## Context

AgentStudio's original `run_command` path collected all output in memory and terminated every command after at most 30 seconds. That model cannot support long builds, servers, watchers, or other work that must continue while the model performs independent steps.

The researched reference behavior separates model work items from executable background tasks. A shell call can return a task identity immediately; a read-only task-output tool can wait or poll; and a stop tool can terminate the process tree. Output is file-backed, bounded, and retrieved independently from the workspace.

## Decision

`run_command` accepts `run_in_background=true` (plus a camel-case compatibility alias). The application-layer `BackgroundCommandToolPlatform` intercepts that form and exposes `task_output` and `task_stop`. Foreground execution still delegates to the existing executor. All three operations therefore continue through the central schema validation, permission, approval, lifecycle-hook, audit, trace, and UI-action path.

Each background task belongs to the validated chat-thread scope. A task ID from one thread cannot read or stop a task from another thread. Task IDs are unguessable in production, and the scope check is repeated from authoritative private state after every app restart.

Follow-up requests reconstruct bounded historical function-call/result pairs from the persisted chat actions. This preserves the provider protocol and lets the model reuse an exact task ID instead of rerunning the command. Raw historical arguments are deliberately not reconstructed because the renderer stores only a display-safe summary; historical outputs are validated, size-bounded, and projected through the existing provider-context limits.

Foreground and background processes resolve through the same platform-specific command specification. They share the environment allowlist, macOS Seatbelt profile, Linux bubblewrap arguments, Windows fail-closed behavior, and process-tree termination helper. No user-controlled value is interpolated into a host-side `exec` call.

The main process resolves the approved sandbox command into an executable plus argument array, then passes a size-bounded bootstrap through a private file descriptor to a detached Node/Electron sidecar. The sidecar receives only the filtered environment, starts the command without shell interpolation at this boundary, owns its output handle and process-tree lifetime, and continues when the desktop process exits.

Output is streamed to an owner-only file below Electron `userData/background-command-output`. Creation uses exclusive, no-follow file opening where supported; reads also reject final-component symlinks. Model-visible retrieval is limited to the latest 100,000 bytes, while a 5GB disk guard terminates runaway producers. Per-command execution and output waits are independently bounded at ten minutes. Timeout, output-limit, non-zero exit, explicit stop, and spawn failure produce distinct terminal evidence.

The sidecar atomically checkpoints a versioned, strictly parsed snapshot and heartbeat. `TaskOutput` therefore needs no live `ChildProcess` object. `TaskStop` writes an exclusive control request containing a random 256-bit capability; only the sidecar holding the matching capability acts on it. A PID is retained only as diagnostic state and is never used as restart-time ownership evidence or termination authority, avoiding PID-reuse attacks. Normal app shutdown deliberately does not call the test/cleanup-only `stopAll()` path.

Terminal records carry a durable delivery receipt separate from their model-visible snapshot. The root runtime serially claims up to ten new completions in its chat scope, reads at most 20,000 output bytes per task, XML-escapes every dynamic value, and caps combined context at 50,000 characters. A request-local accumulator preserves claimed results across tool rounds while also discovering commands that finish between model steps. Worker-started commands use the parent chat scope, preventing inaccessible orphan task IDs. Completion output is explicitly labelled untrusted and cannot become system instructions by closing its wrapper tag.

A second receipt independently drives renderer notification. Only after the validated main renderer announces readiness does a one-second monitor claim terminal notices and emit a narrow payload containing task ID, chat scope, description, terminal status, time, exit code and bounded error—never command output, workspace paths, control capabilities or PIDs. The renderer subscribes through preload and an infrastructure bridge, shows at most three ten-second toasts, and can switch to the owning chat. Model delivery cannot be lost merely because the renderer receipt was claimed, or vice versa.

`task_output` is read risk and can be used in read-only mode. Starting and stopping a command are execute risk: they remain blocked in read-only mode, require approval in workspace-write mode unless a stricter/explicit rule decides otherwise, and execute automatically only in danger-full-access when no central rule tightens policy.

## Consequences

- Long-running commands no longer consume the foreground tool timeout or force the model to wait blindly.
- A follow-up turn in the same chat can inspect or stop the command; unrelated chats cannot.
- A fresh app process can read the original sidecar's status/output and can request a capability-authorized stop. Production-bundle integration tests cover both a new supervisor instance and a real launcher-process exit.
- Closing the Electron app leaves bounded sidecars running until completion, explicit stop, timeout, or output-limit termination. Terminal records are retained with a cap of 100 and pruned on later starts.
- Private task state now contains the command text and description as well as the capability. The directory and files are owner-only, but users should still avoid putting secrets directly in shell command lines.
- An abnormal sidecar crash can leave stale running state; AgentStudio intentionally does not fall back to PID-only termination.
- Model completion context is delivered at the next active model step or user turn. An open, ready renderer receives a toast independently. AgentStudio does not install an OS service or wake a closed desktop process solely for notifications.
