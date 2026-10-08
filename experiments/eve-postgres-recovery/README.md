# PostgreSQL crash recovery experiment

See [the measured decision and deployment boundary](../../docs/eve-prelaunch-cutover.md). No production dependency is replaced. Node24.20.0, Bun1.3.11 and PostgreSQL17.11 were used.

Install the isolated exact candidates and create a fresh disposable lane_d database for each version:

```sh
bun install --cwd experiments/eve-postgres-recovery --frozen-lockfile
bash tests/eve-retirement-postgres/cluster.sh start
bun experiments/eve-postgres-recovery/probe.ts /absolute/new/connection.json 0.16.6
# Use another fresh cluster for the breaking Graphile migration:
bun experiments/eve-postgres-recovery/probe.ts /absolute/other/connection.json 0.18.0
```

`probe.ts` checks owned loopback fixture configuration, starts two independent children, pauses a slow live worker, kills the other and starts its replacement. Frequent supported stale-lock scans do not release the recent dead lock. Only observed child death plus that child's captured lock identity permits `forceUnlockWorkers`. The live/foreign-ID negative controls retain the other worker's lock. Both tasks then execute their original input once; no job is re-enqueued. Data, starts/scans, effects and `report.json` stay in the printed private temporary directory. On test cleanup, only owned child handles are killed.

For the released World adapter comparison, use a fresh D database, apply ChatJS setup, and then apply **candidate** World5.0.2's own migrations with an explicit disposable URL. Keep the original EVE installation:

```sh
bun install --cwd tests/eve-retirement-runtime --frozen-lockfile
bash tests/eve-retirement-postgres/setup-db.sh /absolute/new/connection.json lane_d
# Use env -i and the exact disposable URL from that handoff; never a live env file.
env -i PATH=/opt/homebrew/opt/node@24/bin:/usr/bin:/bin WORKFLOW_POSTGRES_URL=postgresql://retirement@127.0.0.1:PORT/lane_d node experiments/eve-postgres-recovery/node_modules/@workflow/world-postgres/bin/setup.js
bun experiments/eve-postgres-recovery/prepare-adapter-probe.ts
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun apps/chat/.eve/oct8/released.ts --postgres /absolute/new/connection.json --callbacks --abrupt-server
```

The preparer hash-checks the shared driver, fixes its client/fixture imports to the published EVE baseline and changes only the disposable provider overlay. It does not edit the production installation. The expected current result is a 60-second candidate timeout; an initial run without new World migrations fails earlier at startup and is not crash-recovery evidence. The current ChatJS lifecycle guard also rejects the upgraded schema, so changing the package requires a separate adapter/schema integration review.

Re-run the original full-EVE positive comparison separately:

```sh
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun tests/eve-retirement-runtime/restart.ts --postgres /absolute/fresh/current-schema/connection.json --callbacks --abrupt-server --operator-recovery
```

That proof has the stricter existing exclusive-database prerequisite and verifies candidate/settlement/original effect. It is explicitly operator assisted. Local queue ownership proof does not automatically equip EVE's World with a supported worker-registration interface.
