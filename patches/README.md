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
