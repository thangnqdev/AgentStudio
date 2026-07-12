# ADR-0006: Human-gated signed skill learning from sanitized trajectories

- Status: Accepted
- Date: 2026-07-12
- Milestone: Agent OS / Skill learning

## Context

Successful agent trajectories contain reusable operational patterns, but observability intentionally excludes prompts, file content, tool arguments and outputs. Turning traces directly into executable code or production instructions would bypass review and expand the attack surface.

## Decision

Learning consumes only a completed unified trace and its allow-listed metadata. A pure generator creates a candidate `SKILL.md` from the successful tool sequence, plus generated static tests. It never reconstructs task content and never creates scripts or tool arguments.

The candidate evaluator is a capability-free application service: it receives immutable candidate data and has no filesystem, network, tool executor, model or policy port. It checks source provenance, bounded instructions, represented tool sequence and absence of policy-bypass language. Evaluation and explicit local-user approval are separate state transitions.

Only an approved, passing candidate may be promoted. Infrastructure writes it to Electron `userData/skills`, never the source repository, signs the exact `SKILL.md` bytes and semantic version with an owner-only local HMAC key, and stores a signature manifest. The skill catalog verifies that manifest for learned skills before discovery. A changed learned skill therefore becomes unavailable until recreated and approved.

## Invariants

1. Source trace status is `succeeded` and contains at least one succeeded tool call.
2. Candidate fields contain no prompts, arguments, output, paths, credentials or retrieved content.
3. Generated tests are versioned and evaluation cannot mutate the candidate.
4. Approval requires a passing evaluation and is an explicit IPC action by the local user.
5. Promotion requires the approved candidate digest to match the evaluated and approved digest.
6. Promoted content is signed/versioned and written only under application user data.
7. Learned skills still require the existing trust/enable flow and never bypass central tool policy.

## Consequences

Learning is conservative: sanitized traces can teach tool-order playbooks, not task-specific knowledge. Richer synthesis would require a separately consented, redacted dataset and a new ADR. Automatic promotion and runtime source edits remain forbidden.
