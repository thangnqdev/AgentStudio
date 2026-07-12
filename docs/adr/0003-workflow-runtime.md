# ADR-0003: Deterministic local workflow graph runtime

- Status: Accepted
- Date: 2026-07-12
- Milestone: Agent OS / Workflow runtime

## Context

The agent loop is durable but implicit. AgentStudio needs explicit workflows with sequence, branch, retry, approval and safe parallel reads before any multi-agent orchestration.

## Decision

Workflows are versioned directed acyclic graphs. Action nodes invoke an injected capability executor; branch nodes use a deliberately small equality predicate over a prior node's primitive result; approval nodes checkpoint and pause until an explicit renderer decision; parallel nodes execute only child action nodes declared `read` risk. Retry is local to one action and bounded.

The application runtime validates the complete graph before execution, persists a `NodeCheckpoint` after every transition, and resumes only when workflow ID/version match. Checkpoints contain statuses, attempts, timing and primitive results—not prompts, tool payloads or file content. Infrastructure adapters may implement capabilities, but existing tool policy remains authoritative and is not modified by workflows.

## Invariants

1. Node IDs are unique; edges reference existing nodes; the graph is acyclic.
2. Branch nodes have exactly one `true` and one `false` edge.
3. Parallel children are action nodes with declared `read` risk and cannot be scheduled independently.
4. Retry attempts and delay are bounded; failed terminal nodes cannot be silently skipped.
5. Approval without a decision pauses durably; denial fails the run; approval never changes global security policy.
6. Resume requires the exact workflow version and continues from the persisted node without replaying successful nodes.
7. Multi-agent nodes, arbitrary expression evaluation and parallel writes are not supported.

## Consequences

The runtime is predictable, testable and local-first. The equality-only branch DSL and primitive results intentionally limit expressiveness. Capability routing and richer telemetry belong to later milestones; multi-agent orchestration requires a separate ADR.
