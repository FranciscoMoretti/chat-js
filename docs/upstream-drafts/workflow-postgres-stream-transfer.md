# Draft: PostgreSQL stream resume downloads the skipped prefix

Status: unpublished; requires user review before submission.

Target: `vercel/workflow`, `packages/world-postgres`.
Observed package: `@workflow/world-postgres@5.0.0-beta.40`.

## Problem

`createStreamer().streams.get(runId, name, startIndex)` fetches every stored
chunk's payload before applying `startIndex` in JavaScript. Reconnecting near
the tail therefore transfers the entire history from PostgreSQL, even though
only the unread suffix reaches the consumer. This matters for long streams
and repeated billing reconciliation against a metered database.

Source evidence: installed `dist/streamer.js`, `get()` implementation. The
query selects `chunkId`, `eof`, and `chunkData`, filters only by `streamId`,
and orders by `chunkId`. `enqueue()` decrements `offset` to discard the
already downloaded prefix.

The maintained adapter patch now resolves an existing positive cursor to a
payload-free chunk ID boundary and selects only the suffix. Local PostgreSQL
tests validate the emitted sequence and the payload query's ID predicate;
wire bytes have not been measured. Our app's durable billing cursor uses this
positive-index path after the initial reconciliation.

Zero and negative indices, and positive indices beyond the stored tail, retain
the original query path. This patch does not claim to optimize those reads.
A future-index test also exposed a notification-overlap bug: skipped chunks did
not advance the deduplication ID, allowing the same chunk to decrement the
offset twice. The patch records skipped IDs before decrementing the offset.

## Proposed direction

For a positive absolute cursor within the stored stream, resolve the preceding
chunk ID using a query that does not select payloads, then read only rows after
that boundary. Register the notification listener before the queries and use
the boundary to suppress already consumed buffered notifications.

Preserve negative tail-relative indices, indices beyond the current tail,
empty streams, EOF, and append/reconnect behavior. Do not silently change an
absolute cursor into a relative one or allow notification overlap to duplicate
chunks. Keep fallback semantics explicit until those cases are covered.

## Local reproduction and acceptance checks

Use local PostgreSQL and an isolated fixture stream, not production history:

1. Write a known prefix with sizeable payloads and a short suffix.
2. Resume from the suffix and assert the exact emitted chunk sequence.
3. Capture executed SQL or driver results to verify skipped payloads never
   cross the database connection; consumer output alone cannot prove this.
4. Append while the initial query is in flight and verify ordered, once-only
   delivery across the query/notification boundary.
5. Cover zero, negative, at-tail, beyond-tail, empty, and EOF indices, and
   cancellation/listener cleanup.

The intended result is lower database transfer with identical stream behavior.

## Current local validation

`tests/eve-postgres-stream-resume.e2e.ts` covers payload-free boundary selection,
suffix-query filtering, at-tail EOF, zero/negative indices, empty streams, live
appends, and future-cursor delivery. Tests use an isolated local fixture and
remove only its stream rows. Existing queue patch hunks are preserved.

The live tests exercise notification overlap but do not impose a deterministic
barrier around the initial query; a controlled race test remains desirable.
