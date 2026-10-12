# Extra Production Audit

Scope: apps/electron/**, scripts/\*.ts excluding \*.test.ts, packages/cli/src/**/*.ts excluding *.test.ts. Shared-worktree baseline comparisons include earlier root/agent fixes; changes made in this final pass are called out separately. No dependency or lint configuration changes. Generated outputs remain root-coordinated.

## Implemented This Pass

- Removed three require-await hooks by awaiting actual Node child-process close in Forge; initial synchronous branding bootstrap remains synchronous. Async and sync commands are normalized to the selected scaffold package manager.
- Removed Electron IPC no-unsafe-argument by receiving unknown and validating known string/boolean/scope/additional-data fields before requestAuth. Valid original objects, empty strings, false, and unknown extension fields remain intact. Malformed IPC payloads now fail safely through the existing auth error state. This is intentional boundary hardening: inspection proved the old comment claiming SDK validation false (installed client.mjs requestAuth reads cfg and Object.entries directly).
- Extracted CLI document-tool expansion from prompt orchestration, removing complexity while preserving source order and gateway/tool/storage decisions.
- Converted internal SnapshotOptions to interface after caller checks.
- Static postgres import removes unsafe dynamic module destructuring. Both script-root and chat-workspace createRequire.resolve resolve the exact same /Users/fran/Code/chat-js-1/node_modules/postgres/cjs/src/index.js; filesystem realpaths match, preserving installed workspace version without dependency changes.
- WorkflowTools generator now emits interfaces; grouped registration parser handles interface as a type export. Empty workflows remain Record<never, never>. Removed generated alias suppression source. Expanded generated workflow lint coverage and interface export tests. Actual consumers only intersect workflow keys then map NativeToolUI; no Record generic constraint requires aliases. Root regeneration passed and refreshed-template tests pass.

## Verification

- Scoped type-aware oxlint apps/electron scripts packages/cli/src: zero diagnostics, 120 files (/tmp/extra-production-lint.json).
- CLI noEmit-only tsc: passed (/tmp/extra-cli-types.log). Electron noEmit-only tsc: passed (/tmp/extra-electron-types.log).
- 50 focused create/sync/registration/preview/snapshot tests passed across 5 files (/tmp/extra-production-tests.log).
- 2 refreshed generated Electron Node/tsx + Forge hook tests passed, 8 assertions including both child close completions and selected package-manager commands (/tmp/extra-electron-hooks-tests.log).
- 15 valid/invalid IPC boundary tests passed (/tmp/extra-electron-ipc-tests.log).
- 16 installation/dependency/package-resolution/transport/service contract tests passed across 6 files (/tmp/extra-retention-tests.log).
- Scoped git diff --check passed. No production builds were run. Root coordinates full lint/types/generators.

## Retention Evidence

- Electron script .catch entrypoints: Node/tsx generated prebuilds are CommonJS and cannot use top-level await; rejection handlers set exitCode and print failures. Refreshed generated Node/tsx execution tests pass.
- Electron session polling: each server session result must be checked against current native cookies before a 250ms backoff and another fetch; no overlapping requests or fabricated retry identity.
- scripts/dev-service native promisify(execFile): Node execFile returns ChildProcess immediately but defines its native custom promisifier for stdout/stderr and callback errors. Hand-wrapping loses that contract; service tests prove awaited launchd shutdown and setup ordering. launchd loops wait for prior request/stop completion before another readiness probe.
- scripts/dev-supervisor: real signal handlers mutate stopping and child error/exit handlers mutate exited; pinned no-unmodified-loop-condition cannot see callback writes. Poll results mutate failure counts/lastReadyAt; delay must precede next probe/restart/backoff, and SIGTERM grace must precede SIGKILL. Existing readiness helper tests plus direct handler/control-flow evidence; no claim of new OS supervisor integration coverage.
- scripts/sync-template-snapshot: constructor validates concurrency synchronously before returning; snapshot tests characterize synchronous rejection and active-I/O bounds.
- scripts/test-eve-package: malformed manifest validation throws while map schedules writes; moving throw to async rejection allows later writes to race finally restoration.
- CLI prompts generic Record<Key,boolean> construction: Object.fromEntries erases finite generic key union; every catalog key receives exactly one boolean. A different incremental implementation also needs an assertion. Interactive selection retries only after user submits an empty choice.
- CLI registry transport Proxy: reject insecure URL synchronously before native fetch; async trap changes caller throw boundary. Transport tests assert loopback/HTTPS policy and restored global fetch.
- CLI scaffold cleanup: directories are depth ordered; remove children before their empty parents.
- CLI resolve-package-directory: inspect current manifest then ascend one parent; stop on first matching package or non-missing error. Non-hoisted workspace package resolution test passes.
- CLI installation-dependencies: size checks precede file reads, one user-authored buffer at a time; stop on known usage/unknown source before later unreadable files can change conservative proof. Serial dependency proofs avoid multiplying memory across scans. Owned unchanged unused-dependency pruning test passes.
- CLI installation-plan default providers: visit mutates expected dependency graph, so recompute target before deciding next missing slot. Transitive planning tests pass.
- CLI install-plan: hash and validate one arbitrary user-file buffer at a time; fail before installer writes. Each completed provider rename is recorded before the next so rollback cannot race outstanding rename. Replacement tests verify modified source refusal and rollback baseline preservation.
- CLI sync-tools: directory entries are validated/appended in listing order; first malformed registration stops later reads and determines error.
- CLI preflight: validate each parent path/symlink before traversing its child; parallel traversal could follow unchecked symlink.
- CLI provider-config bitwise: TypeScript NodeFlags.AwaitUsing includes Const; enum equality misses immutable declaration. Compiler exposes no typed public predicate for combined flag. Existing provider-config syntax/type tests are root validated.

## Baseline / Removed / Retained / Unresolved

No pending audit cases remain. This table counts directive memberships, not expanded actual diagnostics.

### no-await-in-loop

Total 23 / 2 / 21 / 0

- `apps/electron/src/main.ts`: 2 / 0 / 2 / 0 Poll sequentially until the native cookie and server session agree. Back off between session polls rather than issue overlapping requests.
- `packages/cli/src/helpers/prompts.ts`: 1 / 0 / 1 / 0 Retry only after the user submits an empty selection.
- `packages/cli/src/helpers/resolve-package-directory.ts`: 1 / 0 / 1 / 0 Inspect the current manifest before advancing to its parent; matches and non-missing errors stop traversal.
- `packages/cli/src/helpers/scaffold.ts`: 1 / 0 / 1 / 0 Remove children before their empty parents.
- `packages/cli/src/utils/install-plan.ts`: 3 / 0 / 3 / 0 Hash each installed file without keeping all source in memory. Read one user-edited file buffer at a time and reject the first modified target before mkdir/installItems; replacement tests assert no writes on conflict. Record each completed rename before starting the next; rollback restores exactly staged providers and must not race an outstanding rename after failure.
- `packages/cli/src/utils/installation-dependencies.ts`: 4 / 0 / 4 / 0 Stop scanning once a subtree proves usage or contains unknown source; later unreadable files must not invalidate that conservative result. Bound memory before reading each user-authored file. Read only after the size check and release each buffer before the next file; arbitrary user trees must not load every source file at once. Each unused-dependency proof scans the user source tree; serial scans retain the per-file memory bound rather than multiplying it by the dependency count.
- `packages/cli/src/utils/installation-plan.ts`: 1 / 0 / 1 / 0 visit mutates the expected dependency graph; resolve the first default provider before target() decides whether the next slot is still missing.
- `packages/cli/src/utils/preflight.ts`: 1 / 0 / 1 / 0 Validate each parent before traversing its child; never follow an unchecked symlink.
- `packages/cli/src/utils/sync-features.ts`: 2 / 2 / 0 / 0
- `packages/cli/src/utils/sync-tools.ts`: 1 / 0 / 1 / 0 Validate and append each directory before visiting the next Dirent so error and registration order match the source listing.
- `scripts/dev-service.ts`: 2 / 0 / 2 / 0 Poll launchd one request at a time to preserve stop completion ordering. launchd readiness checks must stay sequential until the service is released.
- `scripts/dev-supervisor.ts`: 4 / 0 / 4 / 0 This probe updates consecutive failures and lastReadyAt before shouldRestartAfterReadinessFailures decides whether to restart the same child. Space probes for this child by READINESS_POLL_INTERVAL_MS; concurrent probes would change the failure counter and recovery grace period. Wait after SIGTERM before SIGKILL so the current child gets its shutdown grace period before any restart. Delay this restart before doubling the next attempt's backoff and spawning another child.

### typescript/promise-function-async

Total 12 / 9 / 3 / 0

- `apps/electron/src/main.ts`: 1 / 1 / 0 / 0
- `apps/electron/src/preload.ts`: 1 / 1 / 0 / 0
- `packages/cli/src/registry/transport.ts`: 1 / 0 / 1 / 0 Reject an insecure URL synchronously before invoking native fetch; making this Proxy trap async would move that check into a rejected promise.
- `packages/cli/src/utils/sync-features.ts`: 3 / 3 / 0 / 0
- `packages/cli/src/utils/sync-tools.ts`: 1 / 1 / 0 / 0
- `scripts/dev-supervisor.ts`: 1 / 1 / 0 / 0
- `scripts/sync-template-snapshot.ts`: 2 / 1 / 1 / 0 Construct the limiter before returning so invalid concurrency throws synchronously; sync-template-snapshot.test.ts characterizes this public validation contract.
- `scripts/test-eve-package.ts`: 1 / 0 / 1 / 0 Fail malformed manifest validation synchronously so map stops scheduling writes before finally restores originals; async rejection would let remaining writes race restoration.
- `scripts/vercel-preview-build.ts`: 1 / 1 / 0 / 0

### require-await

Total 3 / 3 / 0 / 0

- `apps/electron/forge.config.ts`: 3 / 3 / 0 / 0

### promise/prefer-await-to-then

Total 2 / 0 / 2 / 0

- `apps/electron/scripts/generate-icons.ts`: 1 / 0 / 1 / 0 Generated Node/tsx prebuilds run in CommonJS; handle rejection here because that transform cannot support top-level await.
- `apps/electron/scripts/write-branding.ts`: 1 / 0 / 1 / 0 CommonJS requires this handled asynchronous entry point; top-level await fails the Node/tsx prebuild transform.

### promise/prefer-await-to-callbacks

Total 2 / 0 / 2 / 0

- `apps/electron/scripts/generate-icons.ts`: 1 / 0 / 1 / 0 Generated Node/tsx prebuilds run in CommonJS; handle rejection here because that transform cannot support top-level await.
- `apps/electron/scripts/write-branding.ts`: 1 / 0 / 1 / 0 CommonJS requires this handled asynchronous entry point; top-level await fails the Node/tsx prebuild transform.

### typescript/strict-void-return

Total 2 / 0 / 2 / 0

- `packages/cli/src/helpers/vendor-patched-package.ts`: 1 / 0 / 1 / 0 Node documents promisify(execFile): execFile immediately returns ChildProcess, and its native custom promisifier owns the stdout/stderr promise and rejection details rather than consuming that immediate return.
- `scripts/dev-service.ts`: 1 / 0 / 1 / 0 `promisify(execFile)` exposes stdout/stderr while retaining the direct executable invocation.

### no-unmodified-loop-condition

Total 2 / 0 / 2 / 0

- `scripts/dev-supervisor.ts`: 2 / 0 / 2 / 0 Signal handlers set stopping while readiness probes or delays are awaited; the pinned rule ignores writes inside callbacks. Signal handlers set stopping and child exit/error handlers set exited while this loop awaits; the pinned rule ignores writes inside callbacks.

### typescript/no-unsafe-argument

Total 1 / 1 / 0 / 0

- `apps/electron/src/main.ts`: 1 / 1 / 0 / 0

### complexity

Total 1 / 1 / 0 / 0

- `packages/cli/src/commands/create.ts`: 1 / 1 / 0 / 0

### typescript/no-unsafe-type-assertion

Total 1 / 0 / 1 / 0

- `packages/cli/src/helpers/prompts.ts`: 1 / 0 / 1 / 0 #781: Every input key is emitted exactly once with a boolean value. Native Object.fromEntries types erase finite generic keys; Record<Key, boolean> cannot be initialized incrementally without another assertion. Callers pass the closed auth, core, document, and built-in tool catalogs.

### typescript/consistent-return

Total 1 / 1 / 0 / 0

- `packages/cli/src/utils/provider-config.ts`: 1 / 1 / 0 / 0

### no-bitwise

Total 1 / 0 / 1 / 0

- `packages/cli/src/utils/provider-config.ts`: 1 / 0 / 1 / 0 NodeFlags.AwaitUsing includes Const, so equality misses this immutable declaration; TypeScript exposes no typed public predicate for the combined flag.

### typescript/strict-boolean-expressions

Total 1 / 1 / 0 / 0

- `packages/cli/src/utils/sync-features.ts`: 1 / 1 / 0 / 0

### typescript/prefer-nullish-coalescing

Total 1 / 1 / 0 / 0

- `packages/cli/src/utils/sync-features.ts`: 1 / 1 / 0 / 0

### typescript/consistent-type-definitions

Total 1 / 1 / 0 / 0

- `scripts/sync-template-snapshot.ts`: 1 / 1 / 0 / 0

### typescript/no-unsafe-assignment

Total 1 / 1 / 0 / 0

- `scripts/vercel-preview-build.ts`: 1 / 1 / 0 / 0

Grand total 55 / 21 / 34 / 0.

Generated WorkflowTools suppression is an additional generator-source fix not counted as a baseline directive membership in this scope. Root refresh incorporates the new validator into Electron templates.
