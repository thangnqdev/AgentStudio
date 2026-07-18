# ADR 0020: Bounded OpenAI-compatible stream normalization

## Status

Accepted.

## Context

AgentStudio targets OpenAI-compatible Chat Completions endpoints, but compatible providers differ
at the streaming edges. Some omit the space after `data:`, split transport chunks at arbitrary
bytes, omit a final newline, use text content arrays, repeat cumulative values, or omit tool-call
indexes. Usage may report a single cached-prompt counter or separate cache-read/cache-creation
counters. Parsing all of this inside the provider HTTP adapter made the boundary difficult to test
and left unbounded provider-controlled strings in memory.

## Decision

The HTTP adapter delegates protocol state to two infrastructure helpers. `SseDataDecoder` accepts
complete data lines independent of transport chunking, tolerates optional spacing and CRLF, flushes
the final unterminated line, ignores non-data fields, and rejects a buffer above four million
characters. `OpenAiChatStreamAccumulator` parses only object-shaped JSON chunks and owns content,
finish reason, usage, and tool-call merge state.

Assistant content is capped at two million characters. Tool calls are capped at 128, names and IDs
are bounded, and arguments are capped at one million characters per call. Indexed calls retain
provider order; an omitted index first matches the provider call ID and otherwise receives the next
free slot. Fragmented values append, while a provider's cumulative replacement supersedes the
already observed prefix. Text content arrays are flattened without forwarding unknown block types.

Standard OpenAI `prompt_tokens`, `completion_tokens`, and
`prompt_tokens_details.cached_tokens` remain canonical. Compatible split counters normalize
`input_tokens + cache_read_input_tokens + cache_creation_input_tokens` into total input while
preserving optional cache-hit and cache-write evidence. Counts must be non-negative safe integers;
totals cannot overflow. The optional cache fields are allow-listed across root/worker trace parsing
and displayed in the trace UI.

## Consequences

- Transport fragmentation and minor compatible-provider framing differences no longer change the
  reconstructed assistant message.
- Provider output cannot grow the in-memory assistant/tool-call state without explicit limits.
- Cache behavior is observable without persisting prompt, response, tool arguments, price, or API
  credentials.
- Native Anthropic event streams, OpenAI Responses events, active prompt-cache directives, and
  provider-native PDF blocks remain separate adapters/capabilities rather than being guessed from
  a Chat Completions endpoint.
