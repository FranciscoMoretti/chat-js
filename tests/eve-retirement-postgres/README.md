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
const runtime = await createPersistentRuntime(prepared.source, {
  nodeModules: prepared.nodeModules,
  provenance: "Exact experimental patch hash and base release",
}, { world: "postgres", inlineOwnershipLeaseSeconds: 1 });
```

The preparer copies the fixture, creates a dependency overlay pointing to the existing patched adapter, adds explicit Postgres world configuration to its one plain `defineAgent({` declaration, and writes only the validated disposable URL into the copied `.env`. The original fixture/package installation is unchanged. Existing `experimental` configuration is rejected to avoid silently overwriting it. Normal shared marker/release/crash controls apply. PostgreSQL persists outside the worker directory; `remove()` does not drop its database. The launcher omits `--resume` for Postgres because EVE explicitly restricts that CLI switch to the built-in local world. The adapter's startup recovery owns Postgres replay. This development-server boundary is not direct server SIGKILL or deployed multi-replica recovery.

The launcher accepts `distribution: "production-fork"` on the installation argument only for the pinned old-run seed; default validation still requires published EVE 0.71.3. Supply the production installation's node_modules explicitly and label provenance. A later package switch must retain the same database and compiled artifacts and independently prove historical decoding and active continuations. Never clear workflow rows or resend approval to make migration pass.

Teardown, after every lane finishes:

```sh
bash tests/eve-retirement-postgres/cluster.sh stop /absolute/cluster-root
```

This verifies the ownership marker, stops the cluster and retains data/logs for inspection. Deleting those retained files is a separate explicit cleanup operation. Keep the current shared cluster alive while A/C/B use it.
