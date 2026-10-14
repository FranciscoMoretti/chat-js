# Lane D integrated validation

## Maintenance, 13 October 2026

Merged main `d612af7c128a3d962455f8c4574ae5a69ce2d99e` while preserving the integrated `861a64265` history and earlier evidence. Imported only A-owned maintenance from `c515ad453`, C-owned maintenance from `0b67b1fd4`, B's safe maintenance delta `9432c9169`, and typed follow-up `e783d86e0` (integrated as `7d325bc10`). All four lanes have completed their maintenance scope.

The current lint contract is [the Ultracite defaults policy](lint-policy.md). The old suppression baseline and lane exception ledgers are removed. D removed obsolete directives, retained narrow serial-polling/retirement and Graphile API exceptions, and refreshed the adapter preparer's source hash. Its materialized script passes lint and types with narrow exact-installation import exceptions. The production EVE dependency and package-version set are unchanged; root Graphile 0.16.6 remains a development dependency. Registry output was regenerated from integrated canonical source, preserving A's private deletion executor.

Current integrated validation: `bun lint` including docs/demo parity; all seven `bun test:types` tasks; 116 focused application tests; 61 preview/environment/lint-policy tests; isolated A, C, runtime, and recovery-experiment type checks; and one browser delivery test pass. Pending, rejected, and restored-draft captures were inspected. C reports 13 PostgreSQL checks on its identical imported files and stopped its owned cluster. No historical crash/recovery baseline was rerun for comment/style changes. Logs: `/tmp/e70d-oct13-{integrated-lint,integrated-types,integrated-unit,integrated-copy-unit,d-tests,integrated-browser}.log`; captures: `apps/chat/.eve/oct13-delivery-captures/`.

B's [typed validation](../experiments/eve-approval-receipt/TYPED-VALIDATION-2026-10-13.md) supersedes its interim incomplete audit: zero findings on 11 authored runtime files, four added upstream files, and added upstream hunk lines. The 339 baseline / 336 patched findings belong to inherited upstream source. B reports passing source types, 26 source tests, three checkpoint phases, three boundary tests, and ten stock plus ten patched scenarios. D independently materialized the committed runtime patch and passed its type-aware lint, types, and three boundary tests; the payload now provides a conventional `tsconfig.json` for reliable lint discovery.

Final checks after B integration and the audit-configuration fix: `bun lint` passes; `bun test:types` passes all seven tasks (reused valid cache from the earlier combined run); the 31 adapter tests pass; a fresh 11-file payload audit and type check plus its three boundary tests pass. Both upstream patches apply in order to exact source `fab8ba1424eddfdedd6a177cac21710258da0e81`. Evidence: `/tmp/e70d-oct13-final-{lint,types,adapter}.log` and `/tmp/e70d-oct13-b-final-{lint,types,tests}.log`.

B's affected PostgreSQL driver reproduced the historical dead-worker lock timeout, not successful automatic recovery; its owned cluster is stopped. Its old-run driver again decoded 13 events but could not resume the pending run across the EVE step-version change. That observation is not an open product blocker: the accepted and already-proven [prelaunch retirement procedure](eve-prelaunch-cutover.md) terminally retires old sessions while preserving readable history. Old-session resumability and dual-runtime routing are no longer requirements. Recovery promotion still requires an explicit deployment/ownership choice. No publication, deployment, live session retirement, or production dependency migration is included; fork removal remains unauthorized.

## Historical validation, 7 October 2026

Validated 7 October 2026 in `codex/eve-retirement-baseline-d`. A, B and C's final authorized artifacts are integrated locally. Production remains on `npm:@chat-js/eve@0.61.0-chatjs.0`; the receipt and metadata/creation lookup seams remain. Nothing was published or deployed.

## Integrated changes

- A's private deletion request/executor now live in one tool module, including the canonical registry source. The standalone executor export is removed. Ownership, document revision, cancellation and exact receipt checks remain. Final source/evidence: `4b259ad902`, `4e35fd69b`, `52ee835bd`, `ab29d5eb1`, integrated through `90f7108e4`.
- B's preserved-binding experiment and migration evidence `87b1e035e` integrate as `f2eb649c5`. Approved continuations retain original discovery, parsed arguments and history/output. New calls require fresh discovery and consent; live owner/enabled revocation still applies. The patch remains experimental.
- C's final `ee7086139` and `bf55c8c4f` integrate as `44a6e76cd` and `d33bef992`. Immutable owner/operation/conversation bindings, durable uncertain-before-dispatch CAS, ordered display annotations, scoped reconciliation, legacy/public/copy projection and content-erasing deletion tombstones are implemented. Creation still uses the original immutable allocation-receipt seam. See [submission journal](eve-submission-journal.md).
- D supplies disposable PostgreSQL and verified abrupt server controls. Explicit operator recovery uses supported `forceUnlockWorkers` only after verified process death and exclusive fixture database checks. No approval is resent or workflow/event record rewritten.
- The application backend preflight rejects active EVE runs with incompatible persisted step versions before registration. It reads the configured Workflow database, including `WORKFLOW_POSTGRES_URL`, rather than assuming the application database. Unknown package distributions require a reviewed mapping.

## Integration review and checks

Reviewed CAS ownership, immutable JSONB command equality, exact owner/session joins, rejection transitions, historical annotation imports, public/copy sanitization, and deletion erasure. Uncertain/admitted/received operations cannot be claimed again. Cancellation, timeout and absent receipts do not grant resend permission. Inherited history contributes display without acknowledging a new submission.

Migrations 0009/0010 apply to fresh D-only cluster `chatjs-retirement-pg.IWppeT`, lane_d. All 11 database checksums match committed SQL; migration files 0000–0008 are unchanged. No other lane database received these migrations. The scoped lint baseline was regenerated from integrated source, and every changed entry/fingerprint belongs to C's integrated files or D's formatted restart driver. Lane snapshots were review inputs, not baseline replacements. `demo:check` confirms canonical installation parity.

| Verification | Result |
| --- | --- |
| `bun lint` with Node 24 on PATH | Pass, including exception budget, formatting, type-aware lint, docs doctor and canonical demo check. |
| `bun test:types` | All 7 workspace tasks pass. Run after lint, not concurrently: both prepare generated gateway declarations. |
| Explicit D runtime, D Postgres, A and C isolated TypeScript checks | Pass. |
| C actual PostgreSQL ledger and creation recovery | 13 tests pass. |
| C delivery/tool selection/logical graph/copy/proxy plus migration-history tests | 59 tests pass. |
| D SQL compatibility preflight | 6 tests pass; actual CLI override pass/reject cases also verified. |
| Browser delivery hook | 1 test passes; pending/recovered captures inspected, foreign receipts do not clear pending, earlier coalesced contributor does. Local proof only; no UI Verify fleet baseline. |
| A deletion guards + gateway/MCP tests | 34 tests pass; dedicated PostgreSQL deletion suite 9 pass. |
| Existing PostgreSQL stream/resource/queue/cancellation/lifecycle contracts | 28 tests pass. |
| Preview-build regression tests | 16 tests / 69 assertions pass. |

Node is 24.20.0, Bun 1.3.11 and disposable PostgreSQL 17.11. The former seven root lint errors were fixed with a normal typed Postgres import and an exact root development dependency. Graphile Worker 0.16.6 is a development dependency for the operator proof. The lockfile changes do not change the installed package-version/integrity set.

Host-local evidence: `/tmp/e70d-final-{lint,types,c-pg,c-unit,preflight,browser,migrations}.log`, `/tmp/e70d-final-migration-hashes.txt`, and `apps/chat/.eve/d-integration-captures/`. Prior A/backend proof logs are `/tmp/e70d-integrated-a-{pg,unit}.log` and `/tmp/e70d-pg-contracts.log`. These temporary artifacts supplement the checked-in reproducible commands, not portable release artifacts.

## Historical limits and subsequent decisions

1. **Old active runs cannot cut over.** B's production-fork 0.61 seed retains identical 13-event snapshot history, but active continuation under 0.71.3 fails `CORRUPTED_EVENT_LOG`: persisted `step//eve@0.61.0//createSessionStep` differs from the compiled 0.71.3 step. A completed turn is not necessarily a terminal long-lived run. The accepted 8 October prelaunch retirement procedure now addresses these sessions while preserving readable history; resumability and dual-runtime routing are no longer requirements. This remains a historical compatibility observation, not an open product blocker. Stream-version compatibility is separate from stored snapshot readability.
2. **Automatic abrupt PostgreSQL recovery remains slow.** Graphile 0.16.6 retains dead worker locks until its four-hour stale-lock threshold. A/B/C/D observe a new server with old jobs locked; short probes cannot establish automatic recovery. Never describe lock clearing as automatic baseline success.
3. **Explicit operator recovery passes.** D's fresh exclusive fixture recovers candidate and settlement crashes, different serving PIDs, exact original action and one effect. Evidence: retained `chatjs-eve-retirement-p0MOJ6`, `operator-recovery-{1,2}.json`, `crash-{1,2}.json`, snapshots/effect ledger, `/tmp/e70d-operator-final.log`. This is not a distributed fencing algorithm or a production automatic-unlock policy.
4. **Creation reuse is limited.** Stock 0.71.3 reuses an operation within the same live session, but creates another allocation after terminal reset; the read-only operation lookup is absent. Retain the immutable allocation receipt/first-hook ownership seam. Do not report generic creation idempotency as absent.
5. **Replay can duplicate native events.** C's PostgreSQL in-flight graceful restart recovers a queued token with one dispatch, while appending the initial received message under a new event ID. The application aliases scoped operation identity for display; native history remains authoritative and no exactly-once event/effect guarantee is claimed.
6. **Supported replacements remain missing.** B/C's isolated patches are proposals. The [full inventory](eve-retirement-inventory.md) also retains hook results, compaction usage, checkpoint/import/attachment, sandbox and deployment contracts. Local application preparation is complete; whole-fork retirement is not.

## Reproduction and database lifecycle

Use [disposable PostgreSQL instructions](../tests/eve-retirement-postgres/README.md), [A tests](../tests/eve-retirement-lane-a/README.md), [B final validation](../experiments/eve-approval-receipt/VALIDATION-2026-10-07.md), and [C experiment](../experiments/eve-delivery-correlation/README.md). Materialize C's hash-pinned shared controller with its `setup-postgres.ts` before root type-aware lint. Use Node 24 for Vitest/Playwright.

Shared cluster `chatjs-retirement-pg.H2ZFmo` remains available for the lanes until the parent confirms teardown. D-only cluster data/logs are retained when stopped. `cluster.sh stop` verifies ownership and stops without deleting evidence. No live database credentials or production databases are used.

## Superseding decision — 8 October 2026

Francisco accepts terminal retirement of prelaunch sessions while preserving readable history; old-session resumability and dual-runtime routing are no longer requirements. The [scoped cutover proof and recovery investigation](eve-prelaunch-cutover.md) replace the earlier open migration decision. Crash recovery is not classified as an upstream-only blocker: supported settings, pinned upgrades and narrowly scoped application recovery now have measured comparisons and live-worker negative controls. No live retirement or production dependency change was performed.

Application-owned model accounting is a later, separately reviewed slice: [implementation, retirement liabilities, fork removals and evidence](eve-model-ledger-integration.md). The completed retirement baseline above remains the starting point.
