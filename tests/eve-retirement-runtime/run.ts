import { rm } from "node:fs/promises";

import { createRuntimeFixture } from "./fixture";

const fixtureArgumentIndex = 2;
const fixture = await createRuntimeFixture(
  process.argv[fixtureArgumentIndex] ?? "fixture"
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
const exitCode = await worker.exited;
const successExitCode = 0;
if (exitCode !== successExitCode) {
  throw new Error(
    `Runtime proof failed (${exitCode}); disposable evidence retained at ${fixture.directory}`
  );
}
await rm(fixture.directory, { force: true, recursive: true });
