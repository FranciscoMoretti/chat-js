# Continue the eve fork work on another computer

## Where we stopped

Work is on ChatJS branch `codex/app-owned-branch-prototype`.

- `53dfca90`: isolated app-owned branching/resource prototype.
- `27c14d41`: minimal structured-history continuation experiment on eve 0.52.2.
- `3d5b730a`: upgrade the maintained fork to eve 0.61.0, remove obsolete adapters, align SDK dependencies, and consolidate source patches.

The working tree was clean after that implementation commit. This handoff is a subsequent documentation commit. At handoff preparation the branch had no remote branch or tracking upstream. **Local commits alone are not available on another computer: push this branch first.**

```sh
# On the original computer, from this branch:
git push -u origin codex/app-owned-branch-prototype

# In a clone on the other computer:
git fetch origin
git switch --track origin/codex/app-owned-branch-prototype
bun install --frozen-lockfile
```

Use Node 24+ and Bun; the validated Bun version was 1.3.11. Read repository and subtree AGENTS.md instructions. Local environment files, credentials, databases, services, and worktree port assignments are not transferred by Git. Do not copy another worktree's ports blindly.

## Read these first

1. [Current reduction report](eve-fork-061-reduction.md): keep/replace/remove decisions, validation counts, and remaining limitations. This takes precedence over the older 0.52.2 reports.
2. [Patch instructions](../../patches/README.md): current installed artifact and packaging details.
3. [Minimal history experiment](eve-minimal-history-contract-experiment.md): the two essential guarantees and what the proof does not establish.
4. [App-owned branching feasibility](eve-app-owned-branching-prototype.md) and [prototype README](../../prototypes/app-owned-branching/README.md): immutable prefixes, resource journals, and the isolated SQL proof.
5. [Submission notes](eve-minimal-history-contract-submission-notes.md): upstream contribution status.

The proposal was posted as [vercel/eve#3524](https://github.com/vercel/eve/issues/3524). No implementation PR was opened. The user chose to wait for maintainers; do not post Slack messages, issue comments, or implementation PRs without new authorization. Existing contributing guidance asks external contributors to wait for a maintainer invitation before submitting implementation.

## Current implementation and next work

ChatJS installs published eve 0.61.0 plus `patches/eve@0.61.0.patch`; there is no separately published fork package. `patches/eve-0.61.0.source.patch` contains the native source changes and tests against upstream tag 0.61.0. The native checkout used during development was temporary; **the source patch is the portable copy**.

Production ChatJS still uses native checkpoints. The minimal history contract is proven only for supported settled-history scenarios. Do not delete resource/checkpoint protection on the basis of the prototype.

To continue reducing the fork:

1. Design production immutable history captures and durable success receipts. A memory callback being invoked does not prove capture persistence; eve can log callback failures and continue.
2. Bind selected captures to authorized, immutable creation operations. Retain ownership checks and retry/reconciliation behavior.
3. Preserve source-to-destination message/tool mappings and UI annotations separately from model history.
4. Establish how selections survive compaction and how unsupported framework/provider history is handled. The current importer rejects unsupported semantics.
5. Coordinate documents, attachments, and sandbox snapshots with the selected history boundary. The existing production resource protections remain necessary until replacements pass equivalent tests.
6. Migrate a supported path end-to-end before removing its old checkpoint path. The app-owned SQL model is a throwaway prototype, not a second production transcript.

Useful production starting points: `apps/chat/lib/eve/create-conversation-operation.ts`, `checkpoint-readiness.ts`, `copy-transcript.ts`, `document-history.ts`, `fork-source.ts`, and `apps/chat/lib/db/eve-queries.ts`. The history helper and native tests are in the source patch under `packages/eve/src/execution/session-history-seed*`.

The source patch also retains manual dynamic-model compaction, durable compaction usage, next-start worker startup, approval receipts, message metadata, completion results, and sandbox inventory. The current report links each submitted issue. Do not assume any has been fixed upstream without checking again. 0.61.1 appeared during the prior work; it was inspected but not adopted.

## Reconstruct the native source checkout

A normal ChatJS install uses the committed compiled overlay and does not require rebuilding eve. For native development, use a new separate checkout; never overwrite another existing eve checkout.

```sh
# Set this to the absolute path of the new ChatJS checkout.
chatjs_root="$PWD"
git clone --branch eve@0.61.0 --single-branch https://github.com/vercel/eve.git ../eve-chatjs-061
cd ../eve-chatjs-061
git switch -c codex/chatjs-slim-0.61
git apply "$chatjs_root/patches/eve-0.61.0.source.patch"
```

The previous local build adapted upstream's pnpm workspace/catalog for Bun in this disposable checkout only:

```sh
bun -e 'const file = Bun.file("package.json"); const pkg = await file.json(); const workspace = Bun.YAML.parse(await Bun.file("pnpm-workspace.yaml").text()); pkg.workspaces = { packages: workspace.packages, catalog: workspace.catalog }; await Bun.write("package.json", JSON.stringify(pkg, null, 2) + "\n");'
bun install --ignore-scripts
cd packages/eve
bun run build:compiled
bun scripts/copy-compiled-assets.mjs
bunx tsc -p tsconfig.build.json
bun --conditions=eve-source scripts/build-rolldown.mjs
bun scripts/copy-runtime-assets.mjs
```

That Bun workspace adaptation and its generated lockfile are build-only and intentionally excluded from the ChatJS source patch. The source build dependency tree was not committed; re-resolving upstream ranges may produce different build dependencies. Keep the pristine published vendor bundles when assembling the overlay, as the builder does.

Obtain an untouched package for the assembler:

```sh
published_root=$(mktemp -d)
npm pack eve@0.61.0 --pack-destination "$published_root"
tar -xzf "$published_root/eve-0.61.0.tgz" -C "$published_root"
cd "$chatjs_root"
bun scripts/build-eve-patch.ts ../eve-chatjs-061 "$published_root/package"
bun install
```

The assembler requires source HEAD to remain the upstream tag commit, with fork changes in the working tree/index. It derives the source delta against HEAD; do not commit changes in that temporary source checkout before running it. Changes in ChatJS itself should be committed normally.

Bun retained stale patched files during iteration, even with `--force`. Verify the installed package outside the ChatJS Git tree as described in patches/README.md. Recovery used a genuinely new cache after moving only this worktree's installed `node_modules/eve` aside. Do not remove shared caches or another checkout's dependencies. Root-level helper relocation remains necessary for the tested Bun installation path.

## Validation to resume with

From ChatJS:

```sh
bun lint
bun test:types
(cd apps/chat && bunx vitest run lib/eve lib/ai/mcp tools/platform/deep-research tests/eve-mcp-native-approval.test.ts lib/db/eve-sandbox-run-coverage.test.ts)
bun run --filter @chat-js/thread test:unit
bun run --filter @chat-js/gateways test:unit
bun test packages/cli/src/helpers/vendor-patched-package.test.ts packages/cli/src/helpers/scaffold-contract.test.ts packages/cli/src/helpers/scaffold-content.test.ts packages/cli/src/helpers/scaffold.test.ts
bunx vitest run --config prototypes/app-owned-branching/vitest.config.ts
```

The SQL prototype requires `initdb` and `pg_ctl` on PATH and creates its own disposable PostgreSQL cluster with TCP disabled. It does not use an existing app database.

From native `packages/eve`:

```sh
bunx tsc --noEmit -p tsconfig.json
bunx vitest run --config vitest.unit.config.ts
bunx vitest run --config vitest.integration.config.ts src/execution/session-history-seed.integration.test.ts src/execution/session-transcript-seed.integration.test.ts src/execution/session-fork.integration.test.ts src/execution/session-resource-fork.integration.test.ts src/execution/session-checkpoint.integration.test.ts src/execution/hook-results.integration.test.ts src/execution/sandbox/bindings/microsandbox-runtime.integration.test.ts src/execution/sandbox/bindings/microsandbox-mutations.integration.test.ts src/execution/sandbox/bindings/local-fork-checkpoint.integration.test.ts src/execution/sandbox/ensure-ownership.integration.test.ts src/execution/sandbox/local-session-identity.integration.test.ts src/harness/seed-attachments.integration.test.ts
```

Recorded results are in the reduction report. Raw terminal logs and built temporary checkouts were not committed. Four native unit failures reproduced upstream with the same dependencies; distinguish those from new regressions rather than deleting tests.

## Session constraints to preserve

- No paid model/provider calls; use deterministic mocks.
- No remote/Neon or existing application database; disposable local storage only.
- On the original computer, `/Users/fran/.codex/worktrees/7f9a/chat-js` was a protected source checkout. Do not change it, restart its services, change its dependencies/DB, or inspect/edit/stage/delete its `examples/`.
- No live Workflow-run migration, production deployment, or real-provider snapshot recovery has been certified. `world-postgres@5.0.0-beta.40` remains unchanged.
- No upstream PR, package publication, or external message is part of the current authorization.
