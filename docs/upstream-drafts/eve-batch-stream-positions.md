# Draft: batch stream-position reads for reconciliation

Status: unpublished; requires user review before submission.

Target: Eve session client/runtime and `vercel/workflow` stream storage.
Observed packages: `eve@0.52.2`, `@workflow/world-postgres@5.0.0-beta.40`.

## Problem and measured impact

An application repairs missed usage hooks by reading each session's stream
from a durable billing cursor with `follow: false`. Even when every stream is
unchanged, each session requires an HTTP request, authentication, and a stream
tail lookup. A local owner with 178 conversations took 121,157 milliseconds
and 180 HTTP requests in a measured reconciliation run.

A local adapter now batches exact non-EOF stream chunk counts, compares them
with the application's durable cursors, and opens only changed streams. A
subsequent run with 179 conversations took 90 milliseconds and one HTTP
request. Both measurements used the same Bun profiling harness; host load and
the dataset differed, so these timings are diagnostic observations, not a
controlled latency benchmark. The reduction in stream requests is the
intended mechanism. No transcript bytes are selected by the batch query.

## Requested public capability

Expose an authenticated, bounded batch read of authoritative stream positions,
with a storage-level batch implementation where supported. Preserve the
existing cursor coordinate: `getReadable().getTailIndex() + 1` counts data
chunks, excluding EOF. Report missing streams distinctly from known empty
streams, and authorize every requested session before returning its metadata.

The current application adapter is deliberately tied to the pinned Postgres
schema and Workflow default stream-name convention. A public API would remove
that dependency and permit provider-specific implementations without changing
application reconciliation.

## Recovery constraints

An exact position match says only that the previously ingested prefix covers
the observed stream. It does not declare a session finished, suppress future
appends, or advance a billing cursor. A later append must be reconciled on the
next check. A stream shorter than its durable cursor is an error requiring
recovery, not evidence of settlement.

Do not replace the position check with a terminal-event flag: Eve can emit
`turn.completed` while deferred coordination remains pending, and older
durable sessions can retain older authored hooks. Lifecycle-derived dirty
markers require stronger execution and deployment guarantees.

## Local acceptance evidence

`apps/chat/tests/eve-postgres-stream-resume.e2e.ts` compares batched positions
with the installed provider's `streams.getInfo`, including live appends, EOF,
known empty streams, missing streams, and separate checkpoint namespaces.
`apps/chat/lib/eve/reconcile-usage.test.ts` checks exact-match skipping,
changed/missing streams, shorter-stream rejection, unavailable storage, and
the existing bounded scheduling/ownership behavior. The existing database
cursor tests cover interrupted replay, concurrent idempotent charging,
unpriced usage, and owner-scoped monotonic cursors.

The real-provider tool/billing test in `apps/chat/tests/eve-live.e2e.ts` also
checks an actual Eve-created stream against the durable event cursor, protecting
the default-name and event/chunk mapping on upgrades. It passed locally with
Gemini 2.5 Flash in 5.4 seconds; the app recorded conversation creation in 628
milliseconds. Replay did not double-charge, and browser reload retained the
tool result. These are local observations, not production performance claims.
