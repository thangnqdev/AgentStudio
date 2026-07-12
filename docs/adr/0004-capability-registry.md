# ADR-0004: Read-only unified capability registry and advisory router

- Status: Accepted
- Date: 2026-07-12
- Milestone: Agent OS / Capability registry

## Context

Local tools, MCP tools, retrieval, skills, web search and terminal access are discoverable through unrelated APIs. Selection has no shared availability, risk, reliability, latency or cost view.

## Decision

A `CapabilityRegistry` merges typed, read-only `ICapabilitySource` adapters. Descriptors share identity, kind, risk, availability and an explicit cost estimate whose confidence is `local-zero`, `configured` or `unknown`. Unknown cost is never converted to zero.

Operational metrics are folded from sanitized unified traces: tool spans map to tool/MCP/web capabilities and retrieval spans map to knowledge retrieval. Metrics expose sample count, success rate, mean/p95 latency and failure-type counts. Capabilities without observations return null metrics rather than invented values.

The router returns ranked recommendations plus reasons. It has no tool executor, approval gateway, settings repository or policy port, and therefore cannot execute a capability or alter permissions. Risk filtering is advisory input only; the existing tool policy remains authoritative at execution time.

## Invariants

1. Capability IDs are unique across all sources and stable within their source namespace.
2. Risk and availability are reported, never inferred into a permission grant.
3. Success rate and latency derive only from recorded samples; no samples means `null`.
4. Cost always includes value/unit/confidence; unknown stays unknown.
5. Router output is a proposal and contains no executable arguments or policy mutation.

## Consequences

The registry provides one operational view and a safe basis for later optimization. Metrics for terminal and individual skills remain unknown until those operations emit dedicated spans. Automated routing and policy changes are explicitly deferred.
