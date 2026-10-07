// oxlint-disable-next-line import/no-nodejs-modules -- The isolated native launcher resolves its own fixture directory.
import path from "node:path";

import { createRuntimeFixture } from "./fixture";
import { preparePostgresFixture } from "./postgres-fixture";

const handoffIndex = 2;
const sourceIndex = 3;
const handoff = process.argv[handoffIndex];
if (!handoff) {
  throw new Error("Supply the disposable cluster connection.json path");
}
const prepared = await preparePostgresFixture({
  handoff,
  lane: "lane_d",
  nodeModules: path.join(import.meta.dir, "node_modules"),
  source: process.argv[sourceIndex] ?? path.join(import.meta.dir, "fixture"),
});
const fixture = await createRuntimeFixture(prepared.source, {
  nodeModules: prepared.nodeModules,
  provenance: "Published eve@0.71.3 with ChatJS patched PostgreSQL beta.40",
});
await Bun.write(
  Bun.stdout,
  `Postgres fixture evidence: ${fixture.directory}\n`
);
const worker = Bun.spawn(
  [
    fixture.node,
    fixture.cli,
    "eval",
    "--strict",
    "--verbose",
    "--skip-report",
    "--max-concurrency",
    "1",
    "--timeout",
    "60000",
  ],
  {
    cwd: fixture.directory,
    env: fixture.environment,
    stderr: "inherit",
    stdout: "inherit",
    timeout: 180_000,
  }
);
const successExitCode = 0;
if ((await worker.exited) !== successExitCode) {
  throw new Error(`Postgres proof failed; retained ${fixture.directory}`);
}
