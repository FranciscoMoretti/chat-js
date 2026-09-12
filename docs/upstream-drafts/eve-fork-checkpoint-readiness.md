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

The isolated source implementation now carries checkpoint commands through
session inbox wire version 7 and the serialized session driver. Review found
that its decoder accepted those commands when labeled with versions 0–6 or
without a version; regression tests reproduced all eight cases. The decoder now
rejects them before migration. The source implementation also retains the
existing before-turn readiness route, so rebuilding it will preserve the API
used by initial response comparisons.

Source validation covers immutable retry identity, idle/advanced-source
rejection, failed document preparation, historic wire rejection, and readiness
receipts. The focused inbox/checkpoint suite passes 180 tests; a separate driver
and restoration selection passes 114 tests. These are hermetic source tests,
not proof of compiled worker recovery or application-level continuation.

Before enabling this capability in ChatJS, document manifests need a named
checkpoint identity independent of the normal before-turn manifest. The native
serialized capture must prepare that exact manifest before publishing its
receipt, and forks must resolve the same immutable identity. The running app
still uses the installed before-turn implementation; the broader idle source
changes have not been installed.
