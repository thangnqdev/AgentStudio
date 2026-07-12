# ADR-0005: Evaluation-gated reversible runtime optimizer

- Status: Accepted
- Date: 2026-07-12
- Milestone: Agent OS / Safe optimizer

## Context

AgentStudio has evaluation reports and operational metrics, but runtime tuning is spread across hard-coded defaults. An optimizer must not become a second policy engine or mutate production code.

## Decision

The optimizer owns one versioned, bounded configuration with only: retrieval top-K, lexical/semantic weights, model choice, context budget, retry count, timeout and skill-ranking weight. Permission mode, tool risk, approvals, server credentials, shell commands and file paths are outside its schema and are rejected by allow-list validation.

Every candidate is a complete immutable snapshot based on the current active revision. Evaluation compares two persisted, passing reports from the same versioned agent evaluation suite. The comparison records report IDs, scores, evaluator version and a deterministic configuration digest. Promotion requires a strictly positive configured improvement and an unchanged base revision. Promotion stores the prior configuration in bounded history; rollback restores that exact snapshot as a new revision.

Evaluation report comparison is deliberately separate from activation. This milestone does not claim that a synthetic golden suite measures production quality: operators must produce baseline/candidate reports with the same suite under the two configurations. A tied score never promotes.

## Invariants

1. Only allow-listed bounded parameters can enter persisted optimizer state.
2. Lexical and semantic weights sum to one.
3. Model choice is null or belongs to the configured provider's discovered model allow-list.
4. Evaluation cannot mutate a candidate and carries versioned provenance plus configuration digest.
5. Candidate score must exceed baseline by the configured threshold; equality is rejection.
6. Promotion uses optimistic revision matching and cannot change security policy.
7. Rollback restores a complete previous snapshot and remains auditable as a new revision.

## Consequences

Runtime tuning becomes inspectable and reversible. Model/provider benchmarks remain an explicit operator action because automatic live-model experiments can incur cost and leak task data. Multi-objective or self-directed promotion is deferred.
