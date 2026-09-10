# Maintained dependency patches

## Eve 0.52.2: open a turn for internal approval continuation

`eve@0.52.2.patch` changes one guard in the published `dist/src/harness/tool-loop.js`.
The corresponding upstream source is `packages/eve/src/harness/tool-loop.ts`
at tag `eve@0.52.2` (commit `247b3f05244893170bcf4dbcf20a2e35e416ccee`):

```diff
-    if (emit && hasStepInput(input)) {
+    if (emit && (hasStepInput(input) || emissionState.turnId === "")) {
```

Eve closes conversation turns when parking for approval. The internal approval
coordinator can later reach model execution without a new `StepInput`; the old
guard skipped the preamble and emitted model usage with an empty turn ID. Opening
a turn when emission state is between turns supplies a matching `turn.started`
event and nonempty identity. Steps already inside a turn keep their identity.

The ChatJS live regression covers sending, switching models, reloading while
approval is pending, approving, continuation event identity, usage attribution,
and idempotent usage replay. Run it with the isolated Eve test database.

The large patch line is the minified published module. It must contain exactly
one file diff. Bun's patch generation included unrelated bundled dependency
deletions during initial preparation; those were removed before reinstalling.
Do not retain absolute cache paths or bundled dependency changes when refreshing
this patch. Remove it after an upstream release passes the regression.

Upstream report/publication remains subject to user review.

## Native session checkpoints prototype (not activated)

`eve-session-checkpoints.source.patch` applies to the source checkout at the same
`eve@0.52.2` commit above. It is **not** a Bun `patchedDependencies` entry and does
not alter the running ChatJS worker. It is the first part of the native fork work
for editing and regeneration.

It writes a versioned durable snapshot before a new user turn to the owning
session's `eve.checkpoints` Workflow stream. The writer travels through native
context serialization and rejects a different session identity. Non-message
continuations and active turns do not create checkpoints. Storage failures
propagate before model execution; the writer lock is always released.

The internal run input now accepts a source session and user-turn reference. A
bounded reader validates identity and schema, accepts identical retry records,
and rejects conflicting retries. It scans at most 1,000 records with a ten-second
timeout; sessions beyond that cap cannot currently be forked, even at earlier
turns. Stream cleanup cannot extend that timeout.

Restoration copies model history into a fresh session, preserving the target's
identity, configuration, and execution state. It rejects unresolved tool calls
and source sandbox resources until resource cloning is implemented. The fork
continues the source turn sequence without importing approvals or consumed
execution budgets. Caller authorization is required; this is not a public API.

Validated in the isolated source checkout with 158 focused unit/regression tests,
a real Workflow serialization integration (including binary PDF history), and a
native two-session fork integration that verifies replacement history and an
unchanged source. Source type-checking and linting pass. Both source review
passes found no actionable regression. This does not establish app-level editing
or regeneration support.

Before activating: implement source authorization at the app boundary, inherited
transcript streaming, fork idempotency, sandbox/attachment resource cloning, and
app-level recovery and UI validation. Bound snapshot storage/retention or reuse
existing durable step snapshots: the prototype stores full snapshots, so
retained history can produce quadratic storage growth. A raw checkpoint must
never be adopted as another session unchanged.

No upstream issue or change has been published. Keep the source patch separate
from the active minified package patch until the complete runtime slice passes
app-level validation.
