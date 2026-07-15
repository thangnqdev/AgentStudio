# Reference client parity audit

This document records evidence-backed parity against the reconstructed Claude Code 2.1.88 source at upstream commit `a8a678cb6244e6770e1e421767ff0987a1d95549`. The reference is research material, not a dependency and not a source-copy target. AgentStudio reimplements observable contracts behind its own Electron, provider, permission, persistence, and renderer boundaries.

Statuses:

- **Implemented**: the reference-facing contract and its important runtime invariant exist.
- **Compatible**: the capability exists, but the public name, protocol, or edge behavior differs.
- **Partial**: a useful subset exists while a named runtime boundary is still missing.
- **Missing**: no equivalent model-facing capability exists.
- **Not applicable**: experimental/internal output plumbing that is not a normal client capability.

## Model-facing tool surface

| Reference capability | AgentStudio status | Evidence / remaining boundary |
|---|---|---|
| `Agent` | Implemented | Addressable full worker, foreground/background, resume, permission inheritance, profile/model override, worktree isolation. |
| `SendMessage` | Implemented | Named/broadcast delivery, transcript wake-up, team mailbox, shutdown and plan responses. Cross-process transport is still missing. |
| `TeamCreate`, `TeamDelete` | Implemented in 0.3.0 | One durable team per chat scope, shared task list, flat roster, guarded deletion, renderer state. |
| `TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate` | Compatible | Equivalent lowercase tools persist monotonic IDs, owners, dependency graph, auto-claim and lifecycle hooks. Exact public aliases are missing. |
| `TaskOutput`, `TaskStop` | Partial | Background command output/stop exists; a single reference-style task namespace spanning every background agent/process does not. |
| `AskUserQuestion`, `EnterPlanMode`, `ExitPlanMode` | Implemented | Typed local interaction plus plan-enforced tool policy and private approved plan storage. |
| `EnterWorktree`, `ExitWorktree` | Implemented | Durable, ownership-verified Git worktrees; dirty work is preserved. |
| `Read`, `Write`, `Edit`, `Glob`, `Grep` | Compatible | Safe local equivalents exist as `read_file`, `write_file`, `apply_patch`, `glob`, and `grep`; exact aliases and several reference options are missing. |
| `Bash` / `PowerShell` | Compatible | `run_command` plus supervised background command lifecycle exists with filtered environment and central approval. Shell-specific reference input/output details differ. |
| `WebSearch` | Compatible | Configured `web_search` connector exists. Exact name/result schema differs. |
| `Skill` | Compatible | Trusted/enabled skill discovery and `load_skill` exist; exact name and reference command namespace differ. |
| MCP remote tools | Implemented | Trusted server configuration, stdio/HTTP transports, OAuth/client credentials, dynamic tool catalog, policy and audit are wired. |
| `ToolSearch` | Implemented | Exact always-visible tool, direct/keyword/required-term search, deferred MCP and built-in schemas, next-turn catalog refresh, dynamic MCP discovery, bounded full-schema results, and checkpoint/compaction continuity. |
| `WebFetch` | Missing | No bounded URL fetch/readability pipeline exposed to the model. |
| `LSP` | Missing | No model-facing language-server navigation/diagnostic operations. |
| `NotebookEdit` | Missing | No cell-aware notebook parser/editor or notebook-specific validation. |
| `ListMcpResources`, `ReadMcpResource` | Missing | Tool calls exist, but MCP resource discovery/read is not exposed to the model. |
| `McpAuth` | Partial | Local settings support credentials/OAuth; the model cannot initiate the reference authentication flow. |
| `CronCreate`, `CronDelete`, `CronList` | Missing | Workflow runtime exists, but no scheduled persistent trigger service. |
| `RemoteTrigger` | Missing | No remote wake/trigger transport. |
| `Config` | Partial | Typed settings UI and IPC exist; no tightly scoped model-facing config tool. |
| `TodoWrite` | Compatible/deprecated | Persistent task supervisor supersedes the legacy todo list, but there is no exact compatibility alias. |
| `Brief`, `SyntheticOutput`, REPL-only/Sleep tools | Not applicable or experimental | These are feature-gated/internal communication or test surfaces; revisit only after normal client contracts. |

## Runtime and client subsystems

| Subsystem | Status | Highest-value gap |
|---|---|---|
| Streaming model loop, retries, fallback models | Implemented | Provider-specific message/cache semantics are not fully equivalent. |
| Context budgeting and compaction | Partial | Local projection/compaction and durable deferred-schema continuity exist; reference attachment/delta continuity is not fully equivalent. |
| Permission and approval | Implemented | Broader teammate permission-request mailbox messages remain. |
| Durable sessions/checkpoints | Implemented | Background process reattachment after app restart is missing. |
| Hooks/plugins/agent profiles/skills | Partial to implemented | Several reference hook events and plugin component types remain unsupported by design until separately sandboxed. |
| Agent teams | Implemented core | Unix-domain/cross-session teammate bridge, peer-DM summaries, permission/sandbox request messages remain. |
| MCP | Partial to implemented | Deferred tool search is integrated; resource APIs, model-facing auth and some transport edge cases remain. |
| IDE integration | Missing | LSP, notebook editing, editor selection/diagnostic context. |
| Scheduling and remote control | Missing | Cron scheduler, remote triggers, durable process wake-up. |
| Renderer UX | Partial | Team/worker/approval/plan/worktree state exists; richer activity timeline, mailbox rendering and reference command palette remain. |

## Ordered parity roadmap

1. **`WebFetch`**: URL validation, redirect/size/content-type bounds, private-network protections, readable text extraction, citations and audit.
2. **LSP + notebook editing**: separate ports and adapters; never shell-interpolate paths or trust repository server configuration implicitly.
3. **MCP resources/auth parity**: list/read resource contracts and explicit local auth handoff.
4. **Unified background task namespace**: agents and commands behind compatible output/stop operations, without conflating durable work items.
5. **Cross-process team protocol**: authenticated local transport, permission/sandbox/plan mail, idle and peer-summary envelopes.
6. **Cron/remote triggers**: only after an explicit authorization, persistence, wake-up and abuse-prevention ADR.
7. **Exact compatibility aliases/options** for file, task, skill, web and shell tools after the underlying behaviors are proven.

The full parity objective is therefore **not complete**. Passing tests for one milestone proves that milestone only; this matrix must be updated from source evidence as each remaining boundary is implemented and verified.
