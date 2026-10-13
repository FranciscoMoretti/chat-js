# B typed migration — 13 October 2026

The bounded harness migration is complete. All materialized B-authored files and added upstream hunk lines pass the current ChatJS type-aware lint policy. This supersedes the blocked status at `9432c91697afdee45a0bd98e70b9a81b85d6a601`; the earlier maintenance report and diagnostic counts remain historical evidence.

The branch contains main `d612af7c128a3d962455f8c4574ae5a69ce2d99e` via merge `a13c972e2`. Changes are confined to the experimental patch payloads, launcher and evidence documentation. Production adapter, package pins and repository lint exclusions are unchanged. Lane D owns integration.

## Scope and behavioral constraints

The three controllers now use TypeScript. Shared contracts validate external client/harness imports and JSON evidence; runtime dependencies are supplied explicitly instead of through a mutable global bridge. Receipt schemas preserve additional issuer/principal-type fields so replay comparisons cannot silently discard identity changes. The Node launcher uses native Node 24 type stripping and checks the payload before execution.

Source additions and tests have explicit types and current style compliance. Existing upstream files receive only B-owned hunk fixes. Callback dispatch retains its selected definition as the receiver. Cancellation remains an asynchronous rejection where required by the test contract. Interrupted response promises are handled without awaiting completion before crash barriers. Narrow documented exceptions cover sequential polling/checkpoints and SDK-required asynchronous test callbacks; no rule category is disabled globally.

Receipt binding, durable winning settlement, original callback restoration before rediscovery, live owner/enabled/approval checks, and separate consent for new calls remain intact. Three focused tests protect receipt identity preservation, malformed evidence rejection and nonblocking interrupted-promise handling.

## Validation

| Check | Result |
| --- | --- |
| Materialized runtime type check with pinned TypeScript 6.0.2 | Pass |
| Runtime payload type-aware lint, 11 TypeScript files | 0 diagnostics |
| Four wholly B-authored upstream source/test/config files | 0 diagnostics |
| Added lines in four modified upstream files | 0 diagnostics |
| Full pinned upstream EVE source type check, TypeScript 7.0.2 | Pass |
| Source integration suite | 26 pass, one optional checkpoint skipped |
| Three separate checkpoint processes: ingest, settle, execute | Each passes |
| New evidence/promise contract tests | 3 pass |
| Complete `run-runtime.sh`, fresh frozen installation | Stock 10/10, patched 10/10 |
| Root `bun lint` | Pass, including docs doctor and demo parity |
| Root `bun test:types` | 7 tasks pass |
| Adapter `lib/eve/mcp-tools.test.ts` | 31 pass |

The four modified upstream files have **339 inherited findings on exact upstream HEAD and 336 after the patch**. None of the remaining findings is on B's added lines. The whole upstream repository is not claimed to satisfy ChatJS style rules. The source dependency/build environment was installed before this audit, eliminating the earlier unresolved-tsconfig environment. Structured counts are in [the final audit](TYPED-LINT-AUDIT-2026-10-13.json).

Tools: Bun 1.3.11, Node 24.20.0, Oxlint 1.87.0, type-aware engine 7.0.2004, Oxfmt 0.71.0. Published dependencies remain EVE 0.71.3, AI 7.0.106, provider 4.0.17, provider-utils 5.0.44, Workflow 5.0.1/serde 5.0.0, runtime Zod 4.3.6. The source build uses Zod 4.5.4 as documented by `run.sh`.

To repeat runtime lint after materializing `runtime-fixture.patch` in D's frozen installation, run from this ChatJS checkout with `proof_root` set to that installation:

```sh
./node_modules/.bin/oxlint -c oxlint.config.ts --format json \
  --tsconfig "$proof_root/tsconfig.proof.json" \
  "$proof_root"/runtime*.ts "$proof_root/runtime-fixture"
```

Repository lint alone does not parse patch bodies. The explicit materialized audit above is required. The payload includes `tsconfig.json` extending `tsconfig.proof.json`: Oxlint 1.87 type-aware discovery requires this conventional filename even when `--tsconfig` supplies import-resolution configuration. D independently reproduced the clean 11-file audit, isolated type check, and three boundary tests after adding this configuration bridge.

## Affected Postgres and old-run controllers

Both typed drivers were exercised against a fresh, B-owned PostgreSQL 17.11 cluster on port 52678, dedicated database `lane_b`. Actual app migrations and D's patched Workflow schema/fences setup passed. The cluster was stopped after validation; its data and evidence remain retained. No other cluster or database was modified, and no locks were cleared or aged.

The Postgres proof started two real workers across the abrupt restart, then encountered the known dead-worker job lock before pending-response completion. It reached the 300-second watchdog. There were zero external effects. This is a retained runtime liveness blocker, not a passing full Postgres scenario suite.

The old-run driver seeded the production fork and switched the same database to experimental 0.71.3. All **13 historical events decoded identically**. Pending replay diverged at event 4 because `step//eve@0.61.0//createSessionStep` differs from `step//eve@0.71.3//createSessionStep`; three automatic recovery replays ended in `CORRUPTED_EVENT_LOG`. The client timed out at `resume-pending`. Only the original historical effect exists; no pending-call effect was added. No log rewriting or compatibility shim was introduced.

## Retained local evidence

These paths are local disposable experiment artifacts, not committed dependencies:

- Complete reproducible installation: `/var/folders/yh/gd_w4qx53yd7j9z0lypwzsk00000gn/T/lane-b-released.zGpa1N`; patched scenario evidence `lane-b-workflow-tGWVNf` under the same temporary parent. Launcher log: `/tmp/lane-b-typed-repro.log`.
- Final standalone patched run: `lane-b-workflow-TULmuQ` under that temporary parent.
- Postgres evidence: `chatjs-eve-retirement-GMdiTQ`; driver log `/tmp/lane-b-typed-pg.log`.
- Old-run evidence: `chatjs-eve-retirement-M9YHWu`, including `history-decoded.json`, `old-run-results.json`, effects and both worker logs; driver log `/tmp/lane-b-typed-oldrun.log`.
- Stopped owned cluster: `chatjs-retirement-pg.31fuhk` under that temporary parent.
- Source/checkpoint logs: `/tmp/lane-b-typed-source-final-tests.log`, `/tmp/lane-b-typed-checkpoint.log`.

Payload compliance is ready for D's integration. The old-run replay failure is a historical compatibility observation: the accepted [prelaunch retirement procedure](../../docs/eve-prelaunch-cutover.md) already preserves readable history while terminally retiring those sessions. Old-session resumability is no longer a product requirement. Production recovery still needs the documented deployment/ownership choice, and fork removal is not authorized by this maintenance.
