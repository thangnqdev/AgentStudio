# ADR-0001: Append-only unified agent traces

- Status: Accepted
- Date: 2026-07-12
- Milestone: Agent OS / Unified observability

## Context

Agent tasks already survive pause/resume, but model calls, retrieval, approvals, tools and checkpoints have no shared durable identity. Existing tool audit JSONL records are security audit events, not a task trajectory, and must remain independent.

## Decision

Every task owns one immutable `traceId`, persisted with the task. A trace is an append-only stream containing an `AgentTrace` lifecycle record and typed spans: `ModelCallTrace`, `ToolCallTrace`, `RetrievalTrace`, `ApprovalTrace`, `CheckpointTrace`, and `EvaluationTrace`.

The domain model permits only allow-listed operational metadata. Prompt/message text, retrieval queries/results, tool arguments/output, API keys, credentials, absolute workspace paths and provider URLs are forbidden. The infrastructure persists records as JSONL under Electron `userData`, serializes appends, tolerates corrupt lines on read, and exports only validated records.

Application use-cases create and append spans through `IAgentTraceRepository`. IPC handlers expose list/detail/export operations but contain no trace business logic. The renderer receives only the sanitized domain projection.

## Invariants

1. A task has exactly one stable `traceId` across pause/resume.
2. Every span contains `traceId`, `taskId`, a unique `spanId`, a non-negative step when applicable, timestamps and terminal status.
3. Tool spans always identify the task and agent step; approval spans reference the related tool span.
4. Trace records never contain free-form prompt, tool argument/output, retrieved content, secrets, workspace paths or provider URLs.
5. Trace persistence failures do not change tool policy and do not grant or deny tool execution.

## Consequences

Append-only JSONL makes continuity and export simple and crash-tolerant. Listing requires folding records in memory, acceptable for the local-first milestone. Retention, compaction and remote telemetry are explicitly deferred; changing them requires a later ADR. Agent-wide evaluation may append `EvaluationTrace` records later but cannot mutate existing trajectory records.
