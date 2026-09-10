# Maintained eve runtime patch

`eve@0.52.2.patch` is the active Bun dependency patch. It includes the approval
continuation fix and native session-fork support built from eve tag `eve@0.52.2`
(commit `247b3f05244893170bcf4dbcf20a2e35e416ccee`). Both the worker and browser
client must use this patched package: it advances the stream protocol to 26.

`eve-session-checkpoints.source.patch` preserves the readable source changes
against that tag. It is not a separate `patchedDependencies` entry. The source
patch does not include the independent approval guard described below.

## Approval continuation

The published `dist/src/harness/tool-loop.js` changes one guard. Its upstream
source equivalent in `packages/eve/src/harness/tool-loop.ts` is:

```diff
-    if (emit && hasStepInput(input)) {
+    if (emit && (hasStepInput(input) || emissionState.turnId === "")) {
```

Internal approval continuation can execute without a new `StepInput`, after eve
has closed the prior turn. Opening a turn supplies a nonempty identity for model
hooks and usage attribution. An already active turn retains its identity.

The ChatJS live regression covers pending approval, reload, approval continuation,
usage attribution, and idempotent usage replay against the isolated database.

## Native forks

Before each new user turn, the owning session writes a versioned durable snapshot
to `eve.checkpoints`. The writer travels through native context serialization;
non-message continuations and active turns do not create checkpoints. Storage
failures propagate before model execution.

A fork reads the checkpoint before its selected user turn and seeds a fresh
session's model history. It preserves the target's identity, configuration, and
execution state. It rejects unresolved tool calls and source sandbox resources
until resource cloning is implemented. It does not import approvals or consumed
execution budgets. Identical checkpoint retries are accepted; conflicting ones
fail. Lookup is limited to 1,000 records and ten seconds. Once a source exceeds
the record cap, even its earlier checkpoints cannot currently be forked.

A `history.restored` envelope restores the earlier display through eve's native
message reducer. Session controls, authorization events, and model usage are
excluded. Rebuilding the prefix independently prevents duplicate text on replay.
Nested forks flatten inherited envelopes. Reads are bounded before parsing to
8 MiB, 50,000 events, and ten seconds; oversized histories fail explicitly.

The native HTTP route accepts a validated `fork` reference only when its channel
supplies `authorizeFork`. Omission denies access. The policy runs for the verified
principal before operation replay and again if `onMessage` replaces the principal.
Anonymous and null principals cannot fork. ChatJS checks the source session's
bound ownership. The app still owns immutable operation payload checks.

The source tests cover native checkpoint serialization (including binary PDF
history), replacement history, unchanged sources, repeated display restoration,
nested forks, read bounds, and HTTP source authorization. Source type-checking,
linting, and both review passes have passed. These checks do not establish full
ChatJS editing or regeneration parity. With the patch installed, real-provider
browser tests also pass for tool rendering, conversation reload, usage replay,
model switching, and approval continuation. App lint, types, and unit tests pass.

## Packaging

New helper modules are installed at the package root, with exact `#execution/…`
imports in the patched package manifest. The source layout remains unchanged.
This avoids [Bun's nested patch-file creation bug](https://github.com/oven-sh/bun/issues/13330),
reproduced with Bun 1.3.11. Ordinary mode-644 new files under `dist/src/execution`
fail with `EACCES (mkdir)`; the same files at the package root install normally.
Remove this relocation once the supported Bun versions contain the upstream fix.

To refresh, apply the source patch to the pinned source tag, build eve's compiled
assets and runtime with Node 24, and diff only changed production `.js` and `.d.ts`
files against published 0.52.2. Relocate new helpers as above and retain the
approval guard. Exclude tests, generated cache tags, bundled dependency deletions,
and absolute cache paths. Bun's automatic patch generator has included those
unrelated entries; do not commit them. Verify with a real `bun install`.

## Remaining integration

ChatJS editing controls, branch metadata/navigation, immutable fork operation
recovery, sandbox/attachment resource cloning, and app-level fork browser tests
remain to be implemented. Existing sessions started before checkpoint support
have no checkpoints. Full snapshots can produce quadratic retained storage;
bound retention or reuse native durable step snapshots before production.

No upstream issue or change has been published. Production cutover and upstream
publication remain subject to user review.
