# Maintained eve runtime patch

`eve@0.52.2.patch` is the active Bun dependency patch. It includes the approval continuation fix and native session-fork support built from eve tag `eve@0.52.2` (commit `247b3f05244893170bcf4dbcf20a2e35e416ccee`). Both the worker and browser client must use this patched package: it advances the stream protocol to 26.

`eve-session-checkpoints.source.patch` preserves the readable source changes against that tag. It is not a separate `patchedDependencies` entry. The source patch does not include the independent approval guard described below.

## Approval continuation

The published `dist/src/harness/tool-loop.js` changes one guard. Its upstream source equivalent in `packages/eve/src/harness/tool-loop.ts` is:

```diff
-    if (emit && hasStepInput(input)) {
+    if (emit && (hasStepInput(input) || emissionState.turnId === "")) {
```

Internal approval continuation can execute without a new `StepInput`, after eve has closed the prior turn. Opening a turn supplies a nonempty identity for model hooks and usage attribution. An already active turn retains its identity.

The ChatJS live regression covers pending approval, reload, approval continuation, usage attribution, and idempotent usage replay against the isolated database.

## Native forks

Before each new user turn, the owning session writes a versioned durable snapshot to `eve.checkpoints`. The writer travels through native context serialization; non-message continuations and active turns do not create checkpoints. Storage failures propagate before model execution.

A fork reads the checkpoint before its selected user turn and seeds a fresh session's model history. It preserves the target's identity, configuration, and execution state. It rejects unresolved tool calls and sandbox resources without a supported immutable snapshot. It does not import approvals or consumed execution budgets. Identical checkpoint retries are accepted; conflicting ones fail. Lookup is limited to 1,000 records and ten seconds. Once a source exceeds the record cap, even its earlier checkpoints cannot currently be forked.

A `history.restored` envelope restores the earlier display through eve's native message reducer. Session controls, authorization events, and model usage are excluded. Rebuilding the prefix independently prevents duplicate text on replay. Nested forks flatten inherited envelopes. Reads are bounded before parsing to 8 MiB, 50,000 events, and ten seconds; oversized histories fail explicitly.

The native HTTP route accepts a validated `fork` reference only when its channel supplies `authorizeFork`. Omission denies access. The policy runs for the verified principal before operation replay and again if `onMessage` replaces the principal. Anonymous and null principals cannot fork. ChatJS checks the source session's bound ownership. The app still owns immutable operation payload checks.

The source tests cover native checkpoint serialization (including binary PDF history), replacement history, unchanged sources, repeated display restoration, nested forks, read bounds, and HTTP source authorization. Source type-checking, linting, and both review passes have passed. These checks do not establish full ChatJS editing or regeneration parity. With the patch installed, real-provider browser tests also pass for tool rendering, conversation reload, usage replay, model switching, and approval continuation. The app fork browser test also passes against the installed worker: prefix restoration, a fresh model response, reload, unchanged source, operation replay/conflicts, ownership denial, and billing only the new turn. App lint, types, and unit tests pass.

## Sandbox resources

The local just-bash backend captures an immutable filesystem snapshot before each new user turn. Forks restore into a fresh sandbox identity, preserving attachment bytes and isolating subsequent mutations in the source, branch, and siblings. Snapshots exclude reconnect metadata and environment variables. The inherited filesystem is already initialized, so restoration skips `onSession` to prevent initializers from overwriting it. Applications that depend on that hook for fresh per-session environment setup need a separate restoration policy before adoption.

Capture keys are stable per source session and turn. Transient capture failures propagate before checkpoint publication; retries reuse the immutable snapshot. Symlinks, special files, custom filesystems, and snapshots exceeding 20,000 entries or 128 MiB return no seed. Chat can continue, but resource-dependent forks fail explicitly. Directory enumeration enforces the entry budget incrementally.

Real-filesystem tests cover binary preservation, environment exclusion, branch isolation, idempotent restoration, conflicting seeds, and resource limits. A native workflow integration test forks after a PDF turn and verifies that the branch retains the earlier bytes even after the source file changes. This local backend implementation does not establish cloud-backend support, snapshot retention/garbage collection, or atomic capture of concurrent background writes.

Microsandbox uses its native immutable VM snapshots, resumes the source after capture, and restores a fresh target VM with the target configuration. A persisted fork identity prevents retries from silently reusing a different snapshot. Capture stops and restarts the source VM: background processes and outstanding process handles are not guaranteed to survive. Snapshot retention remains outstanding.

The real-provider ChatJS browser test passes on microsandbox: upload a PDF, send a follow-up, edit that follow-up into a new version, receive a response, reload and open the inherited PDF, then verify the original conversation is unchanged. The native filesystem integration provides the stronger byte-isolation check; the model answer alone cannot prove a reread when its content is also in history.

## Packaging

The additional `eve-collector-inventory.source.patch` records an activity collector's run ID as `$eve.activity_collector` on the session run when the session is created. Its source regression test checks the workflow-start attributes. The compiled change is included in `eve@0.52.2.patch`. This lets a deletion inventory discover that resource from metadata without deserializing session input. It does not purge the collector, cover older sessions, or recover collectors orphaned before session creation succeeds. Apply this source patch after the existing source changes when rebuilding.

New helper modules are installed at the package root, with exact `#execution/…` imports in the patched package manifest. The source layout remains unchanged. This avoids [Bun's nested patch-file creation bug](https://github.com/oven-sh/bun/issues/13330), reproduced with Bun 1.3.11. Ordinary mode-644 new files under `dist/src/execution` fail with `EACCES (mkdir)`; the same files at the package root install normally. The history-restoration step entry lives in the existing `create-session-step` module, which EVE scans for registration. Its relocated helper is a plain async function: putting a `use step` directive in that root helper produces a workflow manifest entry without registering the executable step in the worker. Remove this relocation once the supported Bun versions contain the upstream fix.

To refresh, apply the source patch to the pinned source tag, build eve's compiled assets and runtime with Node 24, and diff only changed production `.js` and `.d.ts` files against published 0.52.2. Relocate new helpers as above and retain the approval guard. Exclude tests, generated cache tags, bundled dependency deletions, and absolute cache paths. Bun's automatic patch generator has included those unrelated entries; do not commit them. Verify with a real `bun install` against a fresh cache and compare the installed changed modules with the build output. Bun 1.3.11 reused an older patched cache entry even after a forced reinstall in this worktree; a successful install alone did not prove that the new code ran.

## Generated apps

Template generation verifies the installed eve package against this patch and packs it into `vendor/eve-0.52.2.tgz`. The generated app uses a local tarball dependency so npm, Bun, pnpm, and Yarn receive the maintained runtime without relying on Bun-specific patch installation. Relocated root helpers are explicitly included in the archive. This is a local distribution mechanism until the fork or upstream release is approved for publication.

Fresh npm and Bun installs have been compared byte-for-byte against the patched runtime modules. Scaffold coverage checks helper inclusion, packaging rejects a stale unpatched dependency, and template generation is reproducible.

## Remaining integration

ChatJS now reserves same-owner branch ancestry and immutable fork operations in its metadata database; EVE owns the restored transcript and fresh execution. The ChatJS message actions now expose edits and regeneration, with retained fork requests across reload and navigation between conversation versions. Inherited turn edits resolve the ancestor that owns the checkpoint. Local just-bash and microsandbox resource cloning are implemented; other backends, per-message sibling navigation, and parallel-response parity remain to be implemented. Existing sessions started before checkpoint support have no checkpoints. Full snapshots can produce quadratic retained storage; bound retention or reuse native durable step snapshots before production.

No upstream issue or change has been published. Production cutover and upstream publication remain subject to user review.

## PostgreSQL workflow cancellation

`workflow-world-postgres@5.0.0-beta.40.patch` removes per-run serialization of distinct queue deliveries. A cancellation delivery must reach the workflow while an earlier invocation eagerly awaits a pending step. Exact delivery idempotency keys retain their existing in-flight and completed-message deduplication. The local queue concurrency regression and live MCP cancellation/next-message test cover this change; see `docs/upstream-drafts/eve-pending-tool-cancellation.md` for the unpublished report.

## Named idle checkpoints

The installed patch adds an immutable named checkpoint command to session inbox wire version 7. Dispatch negotiates that capability; older consumers reject it. The serialized driver captures completed native history without another model turn, prepares application document snapshots through the checkpoint-bearing `session.waiting` hook, and uses a separate resource snapshot key. Forks carry the named identity through both native history and display restoration. Readiness checks precede native child allocation and never return snapshot contents.

The compiled ChatJS regression covers idle capture, later source document edits, two Gemini follow-up forks, inherited display history, and reload. See the unpublished `docs/upstream-drafts/eve-fork-checkpoint-readiness.md` for limitations and the remaining composer integration.

## Local sandbox identity at session creation

The source and runtime patches record a local session's canonical worker root and resolved sandbox backend in its initial durable snapshot and an atomically published `.eve/sandbox-identities` record. Sandbox access checks that identity before provider I/O. Forks receive a fresh identity; historical sessions are not retroactively certified. This preserves the provider boundary while local conversation deletion is being completed.

This is not a portable erasure receipt. Hosted sessions omit the local record. Deletion must still verify native birth evidence and descendants, handle provider allocation uncertainty, and validate native birth receipts before it can rely on the record.

Durable session snapshots now use version 2. Version 1 consumers reject the new contract; version 1 snapshots migrate without a certified local identity. A new `eve.sandbox-identity` stream records session-creation attempts, including a null local identity for hosted attempts. Deletion must reject conflicting attempts and historical sessions without this evidence; the local file alone is insufficient.

New workflow drivers also reject creation results with an older handle or snapshot version before starting any turn. This covers a creation retry dispatched to an older worker, including one that ignores the new receipt writer input.

The native `readSessionSandboxIdentity` helper now reads a bounded prefix of the birth stream and requires every creation attempt to certify the same local identity at snapshot version 2. It rejects hosted or missing evidence, malformed records, conflicting roots/providers, invalid stream indexes, and stalled reads. This is an internal evidence reader: deletion still requires authorization, native writer fences, descendant coverage, a matching filesystem record, and a persisted proof for retries after native payload erasure. The source fork test uses this reader for both parent and child sessions.

An authenticated native `GET /eve/v1/session/:sessionId/sandbox-identity` route exposes this evidence to internal cleanup callers. ChatJS only authorizes it with the deletion header and an owner-matched deleting session binding; ordinary session access cannot read it. Missing or invalid evidence returns an uncached 503 without internal error details. This route does not authorize descendant sessions or perform deletion; coordinator coverage and retry proofs remain open.
