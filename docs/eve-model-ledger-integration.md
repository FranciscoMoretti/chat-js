# Application-owned model accounting: first integration slice

Integrated on `f4548e11161c3504b8296a289b7a22445a938a8f`. Only lane D resumed. This is a reviewable implementation and local fork-removal proposal, not a deployment, package release, upstream upgrade, or authorization to change a live database.

## Result

New conversations and copy reservations use the application model wrapper as their sole model-charge authority. Before each provider invocation, it persists an immutable owner/session/model/turn intent. It records returned cost before SDK output parsing or compaction summary validation, captures early response identifiers, and leaves missing/invalid cost unresolved. The pull-driven stream preserves cancellation, errors, request data and abort signals. Repeated receipts debit once; different provider invocations have different attempt IDs. This does **not** provide exactly-once provider billing.

Child and nested-child attempts debit the original root turn. Maintenance outside an open user turn uses `chatjs:maintenance`; follow-up generation receives explicit owner/session/turn scope. Finishing an existing intent uses its persisted attribution even after a conversation becomes a tombstone. Starting a new attempt requires a bound, owned wrapper conversation.

Live usage ingestion now bills only independent tool receipts and registers child lineage. Removed monetary consumers: `step.completed`, `step.failed`, `compaction.usage`, and `hook.result.modelCalls`. Follow-up hooks return display metadata only. The canonical and installed deep-research resolvers both use the wrapper. No compatibility alias or event/wrapper billing switch remains.

## Migration and old accounting

Generated migration `0011_material_boomer` adds conversation `modelAccountingState` and usage `modelAttempt`. C's migrations 0009/0010 and their snapshots are unchanged. Existing rows default to `unprepared`; only new allocation paths explicitly select `wrapper`. Replaying an existing operation cannot upgrade its authority. Rejected new copy tombstones also receive the new allocation state.

`prepareEveModelAccounting` is an offline function, not an HTTP route or automatic migration. Its caller must stop admission/workers for the chosen scope and supply reviewed, hash-verified archive bytes. The archive identifies the exact database/address/port, owner, root and all registered descendants with decoded events. Preparation verifies the current PostgreSQL target, supported provider schema, native retirement marker, terminal complete run inventory and every run/stream fence before import and again before marking the scope retired. Existing descendant bindings are read even for tombstones. Writes are idempotent; interruption leaves admission closed and permits retry with the same archive. A different archive digest is rejected.

The offline decoder preserves old model charges, auxiliary charges and tool receipts with their original IDs and root attribution. A failed model call previously classified as zero receives a separate unresolved liability if no explicit price exists. **Every imported root also retains an unresolved completeness liability**: old event streams cannot prove every provider attempt returned a receipt. A valid zero is never inferred from a missing, malformed or failed result.

Retired scopes cannot execute new wrapped calls. Registered and guest admission refuse unprepared or unpriced accounting. Before rollout, old liabilities require reviewed provider reconciliation; the preparation function deliberately does not invent a price or clear that gate. Old reservations with no native session also remain unprepared until their absence of spend is independently established. This slice supplies no live reconciliation command. Native history is neither rewritten nor deleted.

## Minimal fork proposal

[Portable removal patch](../experiments/eve-model-accounting/remove-model-events.patch) and [provenance](../experiments/eve-model-accounting/provenance.json) target exactly `3a7acfe6ba42a8dc9d330132b11856962a675705` in `FranciscoMoretti/eve`, the source for `npm:@chat-js/eve@0.61.0-chatjs.0`. The dependency and lockfile remain unchanged.

The patch removes:

- `CompactionUsageStreamEvent`, its builder, public exports and hook-event mapping.
- The compaction usage callback and its tool-loop emission.
- `HookModelCall`, `TurnCompletedHookResult.modelCalls`, protocol model-call fields and hook-result cost normalization.

It retains `hook.result.responseMetadata`, compaction checkpoints, normal step usage evidence, approvals, delivery correlation, history projection and all unrelated fork behavior. Targeted tests retain checkpoint success/rejected-summary coverage and display metadata validation. Removing these accounting additions does not remove the remaining need for the fork. No package was published and no production dependency was repointed. Full fork release validation and a future dependency adoption are separate gates.

## Evidence

All providers were deterministic mocks. PostgreSQL was a newly owned loopback PostgreSQL 17.11 cluster; no live database or paid provider was used.

| Check | Result |
| --- | --- |
| Root `bun lint` including docs/demo parity | Pass |
| Root `bun test:types` | All 7 tasks pass |
| Application focused wrapper/ledger/usage/follow-up/reconciliation tests | 60 pass |
| Broader admission/copy/creation/tool regression selection | 164 test cases pass across the run and targeted timer rerun; one additional suite cannot import, also reproduced on unchanged base |
| Disposable real PostgreSQL proof | Pass: migration setup, owner/target/archive/descendant/fence refusal, old-charge replay, unresolved liabilities, concurrent receipt deduplication, conflicting price/generation refusal, decimal debit, rollback on injected debit failure, early response-ID retention, completion after tombstone |
| Exact production fork public runtime proof | Pass: manual compaction 3 receipts/1 checkpoint; automatic compaction 3 receipts/1 checkpoint; rejected empty summary 3 receipts/0 checkpoints; snapshot replay produces no new calls |
| Fork removal focused source tests | 59 pass: hook results, compaction, tool-loop compaction |
| Portable fork patch | Applies against an isolated Git index at the exact base |
| Isolated proof TypeScript | Pass |

The runtime proof uses public `defineDynamic` model resolution, the exact application wrapper source, installed `@chat-js/eve@0.61.0-chatjs.0`, AI SDK 7.0.106 and Node 24. It verifies the current active-model compaction path. It does not claim support for a separately configured compaction model or reuse the upstream 0.76.3 investigation as production evidence. A helper correction omits the unsupported `--resume` flag when running this older fork locally.

The broader run initially used Node 22 and encountered its unsupported package parsing; Node 24 resolved those errors. A subsequent host pause produced two timer timeouts; both affected files passed an immediate targeted rerun (19 tests). `create-conversation-operation.test.ts` independently fails importing `server-only` on both this change and a fresh archive of the unchanged `f4548e111` source. That baseline test-harness defect is not changed here.

Reproduction:

```sh
# Node 24 on PATH; Bun is the package/script runner.
bun lint
bun test:types
bun x tsc -p tests/eve-model-ledger/tsconfig.json --noEmit
bash tests/eve-retirement-postgres/cluster.sh start
bash tests/eve-retirement-postgres/setup-db.sh /path/to/connection.json lane_d
bun tests/eve-model-ledger/postgres-proof.ts /path/to/connection.json
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun tests/eve-model-ledger/runtime-proof.ts
bash tests/eve-retirement-postgres/cluster.sh stop /path/to/owned-cluster
```

The PostgreSQL proof validates its handoff ownership and loopback database before importing the application client. It seeds isolated fixtures and installs/removes an intentional transaction-failure trigger. Do not run it against an arbitrary URL.

Original implementation preserved unchanged at `/Users/fran/.codex/archives/chatjs-wrapper-ledger-2026-10-13`: exact binary patch, complete changed/untracked file archive, SHA-256 manifest and investigation report. The source checkout `/private/tmp/chatjs-wrapper-ledger` was never edited. Local evidence logs use `/tmp/e70d-ledger-*.log`; the fork checkout is `/private/tmp/e70d-model-accounting-fork`.
