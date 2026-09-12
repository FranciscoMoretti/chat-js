# Draft: expose checkpoint readiness before allocating a fork

Unpublished integration note for EVE 0.52.2.

ChatJS comparison requests create a primary native session, then fork additional
responses before `turn_0`. Returning a session identity does not guarantee that
the workflow has written that initial checkpoint. A child can therefore be
allocated before its source snapshot exists, turning an ordinary initialization
race into a failed child session.

The maintained local patch adds an authenticated, read-only checkpoint lookup.
It returns only the requested session/turn identity and readiness, never the
snapshot. Missing checkpoints have a specific retryable response; invalid or
corrupt records fail closed. ChatJS verifies source ownership and waits for this
receipt before dispatching a new native fork. Existing native operations recover
without requiring their source checkpoint again. Application operation IDs stay
unchanged through an uncertain outcome.

Local tests cover delayed readiness, exact identity, bounded waiting, malformed
and corrupt records, owner authorization, and refusing native allocation before
readiness. The browser test additionally creates two short Gemini Flash-Lite
responses through the real local application and switches between them.

The lookup currently uses EVE's checkpoint reader, which reads snapshot payloads
from the workflow stream. This is not an inexpensive metadata-only readiness
index. An upstream API should ideally expose durable readiness without reading
the history twice, or provide creation/fork semantics that safely wait for the
source checkpoint themselves.

A separate gap remains for continuing an idle completed answer with multiple
models: the next before-turn checkpoint is normally captured when the next
message arrives. Capturing it early under the same turn key would conflict with
manual document edits made while idle. The proposed follow-up is a serialized,
immutable named checkpoint with matching document/resource boundaries; this
note does not claim that capability is implemented.
