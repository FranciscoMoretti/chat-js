# No Await In Loop: Packages And Scripts

Baseline: docs/lint-cleanup-baseline.json, revision d6caaf3cbe3ec4c3d2895f8b5da9a1d7d852272c. Every original no-await-in-loop membership under packages/cli, packages/thread, packages/gateways, and scripts was audited. No original memberships in thread/gateways or generated CLI templates. 36 starting memberships, 11 removed, 25 retained. No newly introduced memberships or unresolved classifications.

| File | Starting | Removed | Retained |
| --- | --: | --: | --: |
| packages/cli/src/helpers/config-docs.test.ts | 1 | 1 | 0 |
| packages/cli/src/helpers/gateway-provider.test.ts | 4 | 2 | 2 |
| packages/cli/src/helpers/prompts.ts | 1 | 0 | 1 |
| packages/cli/src/helpers/resolve-package-directory.ts | 1 | 0 | 1 |
| packages/cli/src/helpers/scaffold.test.ts | 1 | 1 | 0 |
| packages/cli/src/helpers/scaffold.ts | 1 | 0 | 1 |
| packages/cli/src/utils/install-plan.ts | 3 | 0 | 3 |
| packages/cli/src/utils/installation-dependencies.ts | 4 | 0 | 4 |
| packages/cli/src/utils/installation-plan.ts | 1 | 0 | 1 |
| packages/cli/src/utils/preflight.ts | 1 | 0 | 1 |
| packages/cli/src/utils/sync-features.test.ts | 5 | 2 | 3 |
| packages/cli/src/utils/sync-features.ts | 2 | 2 | 0 |
| packages/cli/src/utils/sync-tools.ts | 1 | 0 | 1 |
| packages/cli/test/gateway-selection.test.ts | 1 | 1 | 0 |
| scripts/cleanup-preview-database.mjs | 1 | 0 | 1 |
| scripts/dev-health.test.ts | 2 | 2 | 0 |
| scripts/dev-service.ts | 2 | 0 | 2 |
| scripts/dev-supervisor.ts | 4 | 0 | 4 |
| **Total** | **36** | **11** | **25** |

## Changes

- Configuration docs: read both independent MDX files concurrently, then extract snippets into their ordered Map exactly as before.
- Gateway provider test: read the defaults, generated model snapshot, and manifest concurrently after each gateway switch. Preserve the switch/read barrier because all switches mutate the same fixture.
- Scaffold archive checks: concurrent existence checks against a completed scaffold; no writes occur during these assertions.
- Feature tests: concurrent independent read-only core-file assertions and existence checks. Keep write/sync/read cases that reuse composer-controls.ts sequential.
- initializeFeatureUi: group contributions by their target file. Each file is read once; its contribution removals run in the original order in memory; the final result is written once. The two distinct target files process concurrently. This removes repeated IO without introducing races between edits to composer-controls.ts. Existing feature/scaffold tests verify generated registrations, preserved custom controls, and MCP/upload omission.
- Gateway selection test: concurrent existence checks for three optional feature outputs after creation completes.
- Dev health: stop independent test servers concurrently; rejection scenarios each own a separate server and run concurrently. afterEach still awaits all server stops.

## Every Retention

- helpers/gateway-provider.test.ts (2): configureGatewayProvider overwrites the same default-model and snapshot files on every iteration. All three reads must finish before the next configure call. Test `wires selected defaults and snapshot identity without managing dependencies` checks each intermediate gateway ID and unchanged manifest. Parallelizing switches would assert unrelated iterations' output.
- helpers/prompts.ts (1): promptAuth's while condition depends on selectedProviders from the preceding multiselect. A cancelled prompt exits and an empty selection retries. Concurrent prompts would be simultaneous interactive dialogs. Evidence is the result-controlled loop and caller prompt configuration; no automated terminal-dialog test added.
- helpers/resolve-package-directory.ts (1): ancestor search starts at createRequire.resolve's installed entry. A matching manifest returns immediately; malformed/non-ENOENT errors stop traversal. The next ancestor is only visited after the current result. Existing test `resolves a non-hoisted package from the workspace that declares it` verifies the workspace-anchored path. Retain nearest-match/short-circuit contract instead of reading unrelated ancestors concurrently.
- helpers/scaffold.ts (1): rmdir processes optional-file directories deepest first, then their parents. A parent rmdir attempted before its child finishes would receive ENOTEMPTY (an ignored error) and never retry, leaving directories behind. Existing scaffold tests verify clean optional MCP/upload source omission; the parent/child dependency is explicit in the sorted-directory loop.
- utils/install-plan.ts recordInstalledSource (1): arbitrary installed files are read and hashed one at a time; only hashes persist in the receipt. Concurrent full-file reads would retain all buffers at once, violating the deliberate bounded-memory workflow. The registration refresh/baseline tests verify receipt behavior; buffer-memory bound is source evidence rather than a heap test.
- utils/install-plan.ts protectedFiles (1): validates ordered protected paths and stops at the first modified/unbaselined file before installItems or staging runs. Existing `explicit provider replacement ... refuses modified old source before any write` and inferred-destination tests cover pre-write rejection. Keeping sequential reads preserves the first-path diagnostic and single-file memory bound. This is an explicit error-order/resource retention, not a claim that every read inherently depends on the previous read.
- utils/install-plan.ts staging (1): each completed rename is immediately appended to staged so catch can restore it. Parallel renames could still complete after catch begins restoring earlier entries, leaving an old provider stranded outside tools/chatjs. Existing `failed registration/finalization restores previous provider source, manifest, receipts and lockfiles` tests verify rollback behavior; the code's staged journal proves the rename-to-record dependency.
- utils/installation-dependencies.ts recursive sourceUses (3): returns true immediately when source usage, unknown symlink content, or oversized content means a dependency cannot be proven unused. stat gates readFile at maxSourceBytes; one source Buffer is processed before the next file. Concurrent reads would multiply memory and could let later unreadable-source errors override an already conservative true result. Existing `replacement prunes only owned, unchanged, unused dependencies` verifies used dependencies and oversized unknown-source retention; peak-memory and unreadable-later-entry scheduling are source evidence, not separately benchmarked.
- utils/installation-dependencies.ts owned dependency loop (1): every sourceUses call traverses the same arbitrary user source tree. Sequential scans preserve its single-file memory bound rather than multiplying it by retired dependency count. Same prune test validates final ownership/removal behavior. Retained as a deliberate resource policy, not an artificial data dependency.
- utils/installation-plan.ts (1): each visit mutates expected/replacements and target() recomputes final definitions on the next iteration. Resolving codeExecution can change the subsequent webSearch requirement/provider decision. Existing `plans transitive dependencies and repairs against the complete resulting installation without writing` and exclusive-slot validation tests cover dependency planning. Concurrent visits would inspect stale target state and share visited resolution state.
- utils/preflight.ts (1): lstat each parent before traversing its child. Child lookups through unchecked symlink parents would access outside the managed tree before rejection. Existing duplicate/symlink and gateway provider symlink tests cover rejecting targets without writing. The inner current/parts traversal establishes the security dependency.
- utils/sync-features.test.ts (3): write one custom control subset into shared composer-controls.ts, sync, read exact result, then overwrite with the next subset. Existing test asserts every subset survives sync; parallel cases race the same file. Comments now name this shared mutation explicitly.
- utils/sync-tools.ts (1): source Dirent order defines validation/first-error order and definitions are appended only after each readToolDefinition completes. `sync registers direct installs deterministically ...`, `generated registries sort ...`, and duplicate/symlink tests verify ordered output and safe failures. Serial validation also limits concurrent descriptor/source reads. Exact selection between multiple simultaneous invalid entries is source-order evidence, not a new characterization test.
- scripts/cleanup-preview-database.mjs (1): next Neon pagination URL needs the response's opaque cursor. Existing later-page preview and pagination-loop tests verify cursor chaining and uniqueness before deletion. Pages cannot be requested before their cursor is known.
- scripts/dev-service.ts (2): await launchctl print; a failed print means bootout completed and exits before plist removal/bootstrap. If still loaded, await the polling interval before the next print. Existing `start awaits setup, stops ... then bootstraps` and `stop awaits launchd shutdown before removing the plist` verify release ordering. Loop's try/catch/wait establishes polling dependence.
- scripts/dev-supervisor.ts (4): health result updates failure counts, lastReadyAt, and recovery decision for the current child; delay spaces probes; SIGTERM grace delay must precede SIGKILL; restart backoff must precede another child spawn and doubling the next backoff. Existing dev-recovery tests cover transient/sustained/cold-start failure thresholds. Supervisor comments now name the exact state and signal dependencies. Actual child kill/restart orchestration was not run against the user's development service.

## CLI Fixture Failure Diagnosis And Fix

Both previous failures were executable lookup failures, not async callback regressions: generated temporary projects symlink apps/chat/node_modules, which has no .bin/vitest, while the workspace root has node_modules/.bin/vitest. The generated `bun run test:unit` and `npm run test:unit` scripts could not resolve vitest from the temporary project outside the workspace.

The test-only subprocess helper now prepends the workspace root node_modules/.bin to PATH. It copies only string-valued Bun.env entries into a typed Record<string,string>, because Vite's global environment augmentation also contributes DEV/PROD booleans. No dependency, production script, config, or generated template changes. Both formerly failing tests now pass; full scaffold.test.ts also passes.

## Verification

- PASS focused full-config `bunx oxlint --type-aware packages/cli/src packages/cli/test scripts packages/thread packages/gateways` after final edits.
- PASS direct CLI no-emit TypeScript check after typed subprocess env fix.
- PASS 19 tests: scripts/dev-health.test.ts, helpers/config-docs.test.ts, utils/sync-features.test.ts.
- PASS 27 tests: helpers/scaffold.test.ts, helpers/gateway-provider.test.ts, utils/installation-dependencies.test.ts, scripts/dev-service.test.ts, scripts/dev-recovery.test.ts.
- PASS isolated two formerly failing generated npm/Bun gateway warning cases before broader scaffold suite.
- PASS 50 focused install-plan/planning/sync-tools/resolve-package/pagination tests across 5 files.
- Did not execute gateway-selection.test.ts, whose setup regenerates registry output. Root owns generators and integrated checks. No full lint/types tasks, dependency/config changes, commits, or PRs. No live dev-service lifecycle commands executed.

Unresolved classifications: none. The report distinguishes direct test coverage from source-only scheduling/resource evidence rather than implying every retention has a dedicated scheduling test.
