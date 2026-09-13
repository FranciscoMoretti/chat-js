# Draft: expose immutable checkpoint capture and readiness for forks

Unpublished integration note for EVE 0.52.2.

ChatJS comparison requests create a primary native session, then fork additional responses before `turn_0`. Returning a session identity does not guarantee that the workflow has written that initial checkpoint. A child can otherwise be allocated before its source snapshot exists.

Continuing a completed answer with multiple models needs a different boundary. The next ordinary before-turn checkpoint is captured when the next message arrives. Capturing it early under that same key would conflict with subsequent manual document edits. The installed local patch therefore adds immutable named checkpoints, captured by the serialized native session driver while idle.

The authenticated API provides a read-only before-turn readiness lookup, a named capture command, and a named readiness lookup. Readiness receipts expose only session, turn, and checkpoint identities. Missing records are explicitly retryable. Named capture rejects advanced or active source boundaries, preserves its original snapshot on retry, and runs no model step. Fork requests carry the same named identity through native restoration and display-history restoration. The display reader stops at the named marker without waiting for a future user turn or including later source events.

Session inbox wire version 7 advertises checkpoint support. Older or unversioned payloads cannot acquire this new meaning through migration. Checkpoint dispatch negotiates the consumer version rather than using the legacy stable-inbox fast path. The HTTP fork parser accepts the named field while rejecting unknown or malformed fields. Integration testing exposed both the fast-path and parser gaps; regression tests now cover them.

ChatJS verifies bound source ownership before native access. Its native checkpoint hook captures an immutable document revision manifest before checkpoint publication. Migration 0067 was applied only to local PostgreSQL. Manifests have owner/conversation foreign keys, preserve empty snapshots, and are removed by family document cleanup. Named forks inherit that manifest and earlier ordinary turn boundaries. Their own next-turn boundary captures the selected idle documents. Missing or mismatched manifests prevent native allocation. Existing native operations can recover without requiring their source checkpoint again.

Validation includes source unit tests, a real serialized workflow integration, local PostgreSQL ownership/retry/nested-fork/deletion tests, and the compiled ChatJS browser flow. The live regression creates a short Gemini Flash Lite answer, captures it while idle, edits the source document, and forks two Gemini follow-ups. Both retain the captured revision, render inherited and new native messages, and restore correctly on reload. The same browser test exposed the HTTP parser rejection before the fix. App lint, types, and unit checks also pass.

The checkpoint lookup still reads snapshot payloads from the workflow stream. This is not an inexpensive metadata-only readiness index. An upstream API should expose durable readiness without reading history twice, or safely wait for the source checkpoint as part of creation. All database validation here used local PostgreSQL, not Neon.

Remaining ChatJS work includes connecting the multi-model follow-up composer and its retained operation/recovery UI to this path. The native/browser validation does not prove that UI integration, crash recovery at every resource boundary, or full application feature parity. No upstream publication or production cutover has occurred.
