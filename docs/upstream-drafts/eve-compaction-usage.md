# Draft: expose usage for every compaction model call

Status: unpublished; requires user review before submission.

Observed package: `eve@0.52.2`.

Compaction calls `generateText` to summarize model history but discards its
usage and provider metadata. Applications accounting from `step.completed`
therefore miss these costs. The summary loop may make several paid attempts,
and an empty summary can consume tokens without producing a successful
`compaction.completed` checkpoint.

The local patch emits `compaction.usage` after each returned model call,
before validating its summary. It carries the summary model reference,
session and turn coordinates, available token/cost usage, and gateway
generation reference. It uses the ordinary stamped, persisted event path
and is exposed to authored hooks and clients. `compaction.completed` retains
its existing successful-checkpoint meaning.

ChatJS ingests each event using its durable event ID, shares existing
per-turn rounding, and blocks reconciliation progress when the cost is
unknown. A missing cost is never treated as zero. This does not reconstruct
historical compaction charges or provider calls that throw without returning
usage evidence.

The live check also exposed manual compaction failing for dynamic agents:
it requests a model before dispatching any ordinary `step.started` resolver
event. The patch dispatches the existing live model resolver before compaction,
matching ordinary model preparation. This resolver dispatch does not emit a
synthetic step or turn event. It works after hydration when live provider
objects are unavailable and the resolver must reconstruct them.

Native harness tests cover repeated attempts, empty summaries, and event
ordering. Local database tests cover rounding, unknown costs, and replay.
The ChatJS live test compacts a real conversation through the public client,
checks the authored billing hook recorded the same event, rereads the stream,
and checks replay does not charge twice. The upstream channel compaction eval
also now asserts usage delivery and stable replay; it is included in the
source patch for upstream validation.

Local validation on 2026-09-12 passed: 39 focused native tests, six database
tests, repository lint/types/unit checks, and the live Gemini 2.5 Flash test
in 8.2 seconds. Next.js reported no compilation or connected-session errors.
The standalone upstream eval was updated but not executed in this checkout.
