# ADR 0011: Structured user interaction and plan mode

## Status

Accepted.

## Context

Plain chat text cannot reliably express a bounded decision request, retain option metadata, or stop an agent from implementing before a plan is approved. The researched reference client exposes three exact model-facing tools: `AskUserQuestion`, `EnterPlanMode`, and `ExitPlanMode`. Their important behavior is not only presentation: inputs are bounded, questions are answered through a local UI, entering planning requires consent, and planning changes the effective tool policy.

## Decision

The root-agent tool platform adds the three tool contracts around the existing catalog and executor. Subagents keep their bounded read-only catalog and cannot create interactive prompts. Tool arguments are parsed in application services with strict object shapes, length limits, unique question/option labels, one-to-four question bounds, and two-to-four option bounds. The renderer adds **Other** itself rather than trusting a model-supplied synthetic option.

Some OpenAI-compatible providers serialize a schema-declared nested array/object as a JSON string. The shared argument boundary performs at most one bounded, schema-directed decode for those two structured types before normal validation. It never coerces scalar strings, and decoded values still pass both the generic schema check and the feature-specific parser.

`ElectronUserInteractionManager` owns request-scoped pending responses. The main process emits a typed interaction event; the renderer responds through a narrow IPC command whose controller validates IDs, answer maps, annotations, and size limits before resolving the pending request. Stop, abort, and session completion cancel outstanding interactions. The interaction timeout is ten minutes so a human decision does not fail at the normal short tool deadline.

`ManageAgentPlanMode` owns chat-scoped plan state. `PlanAwareToolPermissionPolicy` checks this state before the existing central policy and blocks write, execute, and mutating network capabilities while planning. Read-only filesystem exploration, task bookkeeping, structured interaction, and web search remain available. This enforcement does not depend on prompt compliance and cannot be bypassed by approving a generic tool dialog.

Entering plan mode requires an accepted local interaction. Exiting requires an active plan session, a bounded Markdown plan, and explicit local approval. Approval writes the plan through `PrivateAgentPlanRepository` below Electron `userData/agent-plans` with an owner-only directory and file, exclusive/no-follow creation, an unguessable filename, and no workspace write. Only after persistence succeeds does the main process close the mode and emit its authoritative state to the renderer.

Question results returned to the provider contain the selected answer plus any selected preview and user note. Approved plan text is also returned to the provider so implementation can follow it. Tool-action summaries deliberately avoid placing full questions, answers, or plans in the renderer action log.

## Consequences

- Structured questions preserve single/multi-select semantics and optional contextual notes without parsing free-form chat.
- Plan Mode is an enforceable capability boundary, not only a system-prompt instruction or banner.
- A rejected plan remains read-only and can be revised without losing its session state.
- Approved plan files survive app restart; an active, unapproved plan session currently exists only for the app lifetime.
- The current renderer supports Markdown preview but no image preview variant.
- Answers, previews, notes, and approved plans are model-visible data. Users must not place credentials or unrelated private material in them.
