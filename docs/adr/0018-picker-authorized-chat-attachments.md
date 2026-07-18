# ADR 0018: Picker-authorized chat attachments

## Status

Accepted.

## Context

The sandboxed renderer is not a trusted source of filesystem paths. Accepting an attachment
`filePath` in `ai:chat:start` would let compromised renderer code ask the Electron main process
to read an unrelated local file and send it to the configured model provider. Persisting that
path in an agent checkpoint would also let a resumed task reread different content later.

## Decision

Renderer code passes a real browser `File` object to preload. Preload alone converts that object
to an operating-system path with Electron `webUtils.getPathForFile` and invokes the dedicated
`attachments:authorize` controller. Main validates the bounded IPC shape, then an application
use-case delegates filesystem checks to an infrastructure gateway.

The gateway accepts only an absolute regular file, opens it without following symlinks where the
platform supports that flag, applies type-specific size bounds, and records device, inode, size,
and modification time. It returns an opaque random capability without returning the path to the
renderer. Capabilities expire after one hour, are process-local, and are capped at 64 entries.
Resolution fails closed if the file disappeared or its fingerprint changed.

`ai:chat:start` drops every renderer-declared path and resolves only a valid capability. Text and
image reads use bounded file handles and repeat regular-file/symlink checks. Durable task records
strip both local paths and capabilities; the already formatted provider conversation remains
available to a resumed task, while an attachment that was never formatted must be selected again.

Workspace chat history uses a separate bounded projection in the renderer and repeats strict
nested validation in Electron main. Only attachment ID, display name, media type, MIME type and
size may persist; local paths, capability tokens, preview URLs and attachment bytes are discarded
at both boundaries. Main ignores renderer-selected workspace paths for history load/save and uses
the active workspace. The workspace picker saves the bounded old history before main commits the
new workspace selection, so an honest switch does not require cross-workspace write authority.

## Consequences

- Selecting or dropping a file remains a direct, visible user authorization action.
- Renderer compromise cannot turn the chat IPC contract into an arbitrary local-file read.
- Replacing a selected file, using a symlink, exceeding a size bound, capability expiry, or app
  restart requires the user to attach the file again.
- Existing chat history retains safe attachment metadata and any already generated conversation,
  but never grants durable filesystem authority; malformed nested history fails validation.
