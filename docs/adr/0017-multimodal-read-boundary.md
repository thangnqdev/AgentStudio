# ADR 0017: Multimodal Read boundary

## Status

Accepted.

## Context

The reference `Read` tool returns text normally but exposes images and PDF pages to the model as supplemental multimodal messages. Returning base64 inside an ordinary tool-result string would waste context, leak large payloads into the activity UI, and fail to make the image visible to multimodal providers. AgentStudio must also preserve the OpenAI tool-call rule that every tool response follows the assistant turn before any new user-role media message.

## Decision

`ToolResult` may carry bounded `supplementalMessages`. `AgentToolCallRunner` serializes only `{ ok, output }` into the corresponding tool response, while `RunAgentSession` appends every tool response first and then appends supplements. The same shape is strictly parsed across child-worker RPC and is handled by the bounded read-only subagent loop. Conversation estimation assigns a bounded visual cost to data URLs instead of treating base64 characters as text tokens.

`LocalFileMediaReader` receives only paths already resolved by the existing workspace/danger-full-access policy. PNG, JPEG, GIF and WebP are magic-byte checked and capped at the shared 5 MB image limit. PDFs require a `%PDF-` header, are capped at 100 MB input, default to at most 10 pages, and accept an explicit one-based range of at most 20 pages. Because OpenAI-compatible Chat Completions has no universal PDF document block, AgentStudio renders pages to JPEG with Poppler and sends standard `image_url` parts. Aggregate rendered bytes are capped at 8 MB.

`pdfinfo` and `pdftoppm` run as fixed executables with argument arrays, the existing environment allowlist, cancellation, timeout and process-tree termination. No file path enters a shell command string. Rendered pages live in a private random temporary directory and are removed in a `finally` block. Missing Poppler, password protection, corruption, oversized ranges and oversized rendered output fail explicitly.

## Consequences

- Root agents, child workers and bounded read-only subagents can visually inspect local images and selected PDF pages.
- Base64 never appears in model-visible tool JSON, renderer action output, audit spans or trace metadata.
- Providers must support OpenAI-style `image_url` content. Native provider PDF blocks, image resizing/dimension metadata and OCR-only fallbacks remain provider-specific compatibility edges.
- Poppler is an explicit runtime prerequisite for PDF page rendering; image reads do not depend on it.
