# Disposable PostgreSQL integration

Run from this isolated checkout. No live application URL is accepted by the preparer. PostgreSQL **17.11** is the verified host version; `EVE_TEST_PG_BIN` can select the directory containing the matching binaries.

```sh
bash tests/eve-retirement-postgres/cluster.sh start
# Use the printed connection.json path. Each lane owns its separate database.
bash tests/eve-retirement-postgres/setup-db.sh /absolute/connection.json lane_a
bash tests/eve-retirement-postgres/setup-db.sh /absolute/connection.json lane_c
bash tests/eve-retirement-postgres/setup-db.sh /absolute/connection.json lane_d
```

The cluster uses a newly created private temporary directory, loopback listening, a private Unix socket, and a disposable `retirement` role with trust authentication. Do not use it for sensitive data. The handoff JSON contains exact URLs, root, port and binary path. The setup applies actual ChatJS migrations/FKs, patched Workflow migrations, and ChatJS resource/queue fences. C owns any later application migrations; do not apply uncommitted lane migrations elsewhere. Run independent proof sequences on separate fresh clusters to avoid orphaned test runs affecting the next scenario.

Runtime/adapter pins: published `eve@0.71.3` / `fab8ba14`, AI SDK `7.0.106`, bundled Workflow core `5.0.1`, existing ChatJS `@workflow/world-postgres@5.0.0-beta.40` with the committed queue/stream patch. The production-fork migration seed is `@chat-js/eve@0.61.0-chatjs.0` / `3a7acfe6`. These are explicit compatibility candidates, not a production package switch.

```sh
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun tests/eve-retirement-runtime/run-postgres.ts /absolute/connection.json
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun tests/eve-retirement-runtime/restart.ts --postgres /absolute/connection.json --callbacks
```

The released-runtime SQL smoke proof passed four gates: create/send/tool execution and durable replay. SQL contains the real workflow runs/events. Restart/old-run migration are separate proofs; smoke success does not establish them.

For a lane's compiled fixture and experimental installation:

```ts
import { preparePostgresFixture } from "/absolute/D/tests/eve-retirement-runtime/postgres-fixture";
import { createPersistentRuntime } from "/absolute/D/tests/eve-retirement-runtime/persistent-runtime";

const prepared = await preparePostgresFixture({
  source: "/absolute/authored-fixture",
  nodeModules: "/absolute/isolated-install/node_modules",
  handoff: "/absolute/connection.json",
  lane: "lane_c", // A uses lane_a; D uses lane_d.
});
const runtime = await createPersistentRuntime(
  prepared.source,
  {
    nodeModules: prepared.nodeModules,
    provenance: "Exact experimental patch hash and base release",
  },
  { world: "postgres", inlineOwnershipLeaseSeconds: 1 }
);
```

The preparer copies the fixture, creates a dependency overlay pointing to the existing patched adapter, adds explicit Postgres world configuration to its one plain `defineAgent({` declaration, and writes only the validated disposable URL into the copied `.env`. The original fixture/package installation is unchanged. Existing `experimental` configuration is rejected to avoid silently overwriting it. Normal shared marker/release/crash controls apply. PostgreSQL persists outside the worker directory; `remove()` does not drop its database. The launcher omits `--resume` for Postgres because EVE explicitly restricts that CLI switch to the built-in local world. The adapter's startup recovery owns Postgres replay. This development-server boundary is not direct server SIGKILL or deployed multi-replica recovery.

The launcher accepts `distribution: "production-fork"` on the installation argument only for the pinned old-run seed; default validation still requires published EVE 0.71.3. Supply the production installation's node_modules explicitly and label provenance. A later package switch must retain the same database and compiled artifacts and independently prove historical decoding and active continuations. Never clear workflow rows or resend approval to make migration pass.

Teardown, after every lane finishes:

```sh
bash tests/eve-retirement-postgres/cluster.sh stop /absolute/cluster-root
```

This verifies the ownership marker, stops the cluster and retains data/logs for inspection. Deleting those retained files is a separate explicit cleanup operation. Keep the current shared cluster alive while A/C/B use it.

## Abrupt serving-process crash

Call `await runtime.crash(serverPid)` with a PID read from the fixture callback or its authenticated process-identity endpoint. The controller validates that PID's parent against its own running CLI, kills the detached server process group, waits for that group to disappear from the OS process table, removes only the dead server's stale URL record, and waits for CLI exit. It retains all world data. Default `crash()` still means CLI SIGKILL followed by detached-server cleanup. Never guess a PID. `runtime.node` exposes the validated Node executable for seed/client subprocesses.

`restart.ts --callbacks --abrupt-server` passes on the built-in local world: different candidate, settlement and effect PIDs, one observed effect, no approval resend. PostgreSQL reaches a new worker, but Graphile Worker 0.16.6 retains dead workers' job locks until its **four-hour** stale-lock threshold (`dist/sql/resetLockedAt.js`). The 60-second Postgres callback probe therefore cannot establish automatic recovery. The SQL evidence has locked jobs owned by the dead workers; do not clear locks or age timestamps and call that baseline recovery. A separately labeled supported administrator recovery can be tested independently. CLI-only shutdown is different: it can durably mark an interrupted approval candidate failed and return to input waiting.

The controller uses `ps` group membership because macOS/Bun can report `EPERM` for `kill(group, 0)` during reaping. Permission errors are never treated as proof of process death. `crash-N.json` records lifecycle progress; the restart driver saves the primary failure before cleanup and preserves both errors if cleanup also fails.

## Supported operator recovery proof

On a **fresh D-only cluster/database**, append `--operator-recovery` to the abrupt callback command. The proof validates the owned loopback handoff and D lane, rechecks that the verified server group is gone, and refuses intervention while any other client database connection exists. Only then it reads exact orphaned worker IDs and calls Graphile 0.16.6's public `forceUnlockWorkers`. It does not modify run/step/event data, age locks, synthesize receipts or resend approval. This is explicit operator intervention, never automatic application behavior.

Both candidate-authorizer and durable-settlement abrupt boundaries pass with this intervention: new serving PIDs, exact original connector and parsed input, one effect. Successful operator runs retain `operator-recovery-N.json`, `crash-N.json`, snapshots and effect ledger. Automatic recovery remains subject to the four-hour provider lease. The fixture database must remain exclusive during the check/intervention window; this is not a distributed fencing algorithm or a safe automatic production unlock policy.

## Package-cutover preflight

The existing application backend build check now reads active EVE run/step identities from the resolved Workflow database (including an explicit `WORKFLOW_POSTGRES_URL`) before backend registration. It rejects a mismatched compiled step version, and excludes terminal historical-only run rows. Six SQL tests cover pending/running rejection, completed/failed/cancelled exclusion, unchanged records and matching versions. The check is a necessary deployment prerequisite, not a migration or a guarantee about all fork contracts. Both reviewed distributions have explicit step-version mappings; unknown distributions require compatibility review.

```sh
EVE_RETIREMENT_POSTGRES_FILE=/absolute/connection.json bunx --no-install vitest run tests/eve-retirement-postgres/compatibility.test.ts
```
