# ADR 0021: Bounded manual context compaction

## Status

Accepted.

## Context

Automatic compaction protects model requests, but users also need an explicit `/compact` action before the active chat reaches its budget. Sending the whole renderer state to a provider for a convenience command would create avoidable cost and data egress. Letting the renderer author a privileged system message, silently truncating long IPC input, or applying an asynchronous result to a changed thread would weaken the existing trust and continuity boundaries.

## Decision

`/compact` opens a local dialog with an optional 2,000-character preservation note. The renderer projects each message to content, bounded tool metadata, and non-authorizing attachment metadata; image/text bytes, preview URLs, file paths and attachment capability tokens do not cross this IPC boundary. Electron main validates every message, rejects duplicate IDs, and caps one request at 1,000 messages and 12 million text characters. Invalid or oversized input fails as a whole rather than being sliced.

The application use case reuses the deterministic pure context-compaction algorithm and excludes renderer-provided system messages. A result is eligible only when at least one older message is removed and the estimated summary-plus-recent context is smaller than the original. The optional note is embedded as bounded preservation text; it does not trigger a provider request or claim semantic model re-summarization. Successful work is bracketed by best-effort audit-only `PreCompact` and `PostCompact` dispatch in main.

Main returns only the local-derived summary, the IDs of recent messages to retain, and approximate token counts. Before changing state, the renderer verifies that both the active thread and the exact message-array snapshot are still current. It then stores one historical `agent` summary followed by the original retained message objects. It never creates a renderer-authored `system` message.

## Consequences

- Manual compaction has no provider cost or new network path and does not transfer attachment capabilities or media bytes.
- Races with streaming, edits, thread switches, or history replacement fail visibly without overwriting newer state.
- A single large recent message, a non-reducing heuristic summary, an invalid payload, or a request above the hard bounds is refused instead of creating misleading compacted history.
- The heuristic summary can omit detail. The preservation note remains visible local-derived context, but it is not equivalent to provider-native or reference-client semantic compaction.
