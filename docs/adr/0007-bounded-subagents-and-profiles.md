# ADR 0007: Bounded read-only subagents and content-bound profiles

## Status

Accepted.

## Context

AgentStudio needs specialized delegation without creating a second path around tool permissions, approvals, audit, cancellation, or context limits. Repository-owned agent instructions are executable influence: trusting a path once is insufficient because the file can change later.

## Decision

`delegate_task` is a normal network-risk tool in the root agent catalog. The existing central policy decides whether the root may invoke it. A delegated run has its own conversation and resilient model loop, inherits root cancellation, and is bounded to eight model steps, a 12,000-character prompt, and a 40,000-character result.

The child catalog is an intersection, never a union: only local `list_files`, `read_file`, and `load_skill` definitions with `read` risk are eligible. Custom profiles may narrow that set. Child calls run in `read-only`, pass through the same permission policy, and are blocked when a rule requires interactive approval. `delegate_task` is absent from the child catalog, preventing recursion.

Custom profiles are Markdown files with YAML frontmatter. Discovery is bounded, rejects escaping symlinks and non-read tools, and requires a kebab-case filename/name match. A profile is usable only after explicit trust and enablement. Its stable preference identity includes a SHA-256 content fingerprint; the content is fingerprinted again immediately before loading. Any edit therefore invalidates prior trust and closes the discovery/load race.

## Consequences

- Delegation is useful for independent exploration, review, and planning while remaining less privileged than the root agent.
- Multiple delegations are currently serial because network-risk tools are not in the concurrent read scheduler.
- Subagent model calls are represented by the parent `delegate_task` tool span; child-level trace spans and cost attribution remain future work.
- Profiles are declarative prompts only. They cannot load JavaScript, execute shell hooks, select unrestricted tools, or change permission mode.
- Editing a profile intentionally requires the user to trust and enable its new identity again.
