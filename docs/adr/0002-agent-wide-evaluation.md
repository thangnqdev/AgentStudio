# ADR-0002: Versioned, immutable agent-wide evaluation

- Status: Accepted
- Date: 2026-07-12
- Milestone: Agent OS / Agent-wide evaluation

## Context

Knowledge retrieval has a standalone benchmark, while task outcomes, tool choice, code changes, policy behavior and trajectories have no common score contract. Optimizers and self-development must not be introduced before a deterministic regression gate exists.

## Decision

An `IAgentEvaluator` consumes a deeply cloned and frozen golden fixture and returns exactly one typed evaluation. Evaluators are pure graders: they receive no task repository, tool executor, policy mutator or write capability. The regression use-case hashes the frozen input before and after every evaluator and fails if it changes.

Every score is normalized to `[0,1]` and carries provenance: fixture/version, evaluator/version, run ID and timestamp. Reports are versioned, append-only JSONL. Golden scenario definitions are version-controlled TypeScript data so packaged Electron builds and the CLI execute the identical suite. Runtime observations are generated fresh by an infrastructure runner on isolated temporary workspaces; only evaluator unit tests retain recorded observation fixtures. Retrieval recall/MRR/nDCG reuse the existing retrieval and metric implementations and appear as a `RetrievalEvaluation` in the same report.

The regression uses a deterministic scripted provider, then runs the production agent session, permission/approval path, local filesystem tools, checkpointing, tracing and lexical retrieval. It does not invoke a live model, access the network, modify a user workspace, change tool policy, promote candidates or tune runtime configuration.

## Invariants

1. Evaluation input is immutable and evaluator mutation is detected.
2. Every score is finite, within `[0,1]`, versioned and attributable to a fixture and evaluator.
3. A report passes only when aggregate and every configured dimension threshold pass.
4. Reports contain scores, counts and stable IDs, not prompts, tool arguments/output, code content or secrets.
5. Evaluation can append `EvaluationTrace` metadata but cannot alter the evaluated trajectory.

## Consequences

The deterministic suite is CI-friendly and safe to run locally. It validates graders plus runtime contracts against curated scripted trajectories, not live-model reasoning quality; live trials can be added later behind the same fixture/result contracts. Optimizer promotion remains out of scope until its own milestone and ADR.
