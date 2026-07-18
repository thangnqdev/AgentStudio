# ADR 0016: Scheduled and remote trigger boundary

## Status

Accepted.

## Context

The reference surface exposes local cron tools and a remote-trigger API. Both can cause future work or network side effects after the model turn that created them. A tool-name-only implementation would be unsafe: schedules need ownership, bounded persistence and retry semantics, while a remote connector needs explicit user authorization and must never reveal its credential to the model or shell.

## Decision

AgentStudio exposes exact deferred `CronCreate`, `CronDelete`, `CronList`, and `RemoteTrigger` names through the normal catalog. They retain central schema validation, permission policy, approval, hooks, audit and tracing.

Cron uses a strict five-field local-time parser and rejects schedules with no match in the next year. Each workspace/chat/owner scope has at most 50 jobs. One-shot jobs delete after a successful claim; recurring jobs advance from the current fire time to prevent catch-up bursts and expire after seven days. Teammates may create only session jobs. Durable lead jobs use private hashed files, atomic owner-only writes, symlink checks, and a private per-scope cross-process lock so two AgentStudio processes cannot claim the same due job concurrently. Delivery enters the existing durable worker/parent mailbox; a failed mailbox write releases the claim for retry. A live teammate may be resumed only while its owning session is active; otherwise delivery remains queued durably for the next resume. Relevant schedulers activate when their tool scope is opened and catch up missed durable jobs. No installer service, login item, or OS-level wake task is created.

Remote Trigger is disabled by default and absent from the model catalog until the user saves a complete configuration in Settings. Base URLs require HTTPS except for loopback HTTP and cannot include credentials, query or fragment. The bearer token is encrypted with Electron `safeStorage` when available, stays in main-process memory, and is added only as an Authorization header. It never enters tool schema, output, shell environment, trace or audit content; bounded endpoint responses are redacted if they echo the configured token. Calls use fixed `/v1/code/triggers` routes, validated IDs, a 20-second timeout, manual redirect rejection, and a 100,000-byte request/response limit. Network-risk approval remains authoritative even after opt-in.

## Consequences

- Models can manage local schedules without gaining a filesystem or process-persistence side channel.
- Durable cron means private state plus catch-up on scope activation, not permission to keep AgentStudio running or wake a closed machine.
- Remote execution requires two gates: explicit connector enablement and the normal network tool policy.
- A configured endpoint is a user-trusted service. Its bounded response is still treated as untrusted model input.
- OS-level background services require a separate ADR, installer lifecycle, revocation UI and abuse analysis before implementation.
