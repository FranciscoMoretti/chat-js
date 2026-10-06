/* oxlint-disable import/no-nodejs-modules -- The isolated test launcher owns temporary directories and process execution. */
import { cp, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

const root = import.meta.dir;
/* oxlint-disable node/no-process-env -- Read only the explicit launcher configuration; no application credentials enter the worker. */
const requestedNode = process.env.EVE_TEST_NODE ?? "node";
const searchPath = process.env.PATH ?? "";
/* oxlint-enable node/no-process-env */
const node = Bun.which(requestedNode);
if (node === null) {
  throw new Error(`Node executable not found: ${requestedNode}`);
}
const version = Bun.spawn([node, "--version"], { stdout: "pipe" });
const versionText = await new Response(version.stdout).text();
const nodeVersionPattern = /^v(?<major>\d+)\./u;
const major = Number(nodeVersionPattern.exec(versionText)?.groups?.major);
const successExitCode = 0;
const fixtureArgumentIndex = 2;
const minimumNodeVersion = 24;
if (
  (await version.exited) !== successExitCode ||
  !Number.isFinite(major) ||
  major < minimumNodeVersion
) {
  throw new Error(
    "Node >=24 is required; set EVE_TEST_NODE to its executable."
  );
}
const installedPackage: unknown = await Bun.file(
  path.join(root, "node_modules/eve/package.json")
).json();
if (
  typeof installedPackage !== "object" ||
  installedPackage === null ||
  !("name" in installedPackage) ||
  installedPackage.name !== "eve" ||
  !("version" in installedPackage) ||
  installedPackage.version !== "0.71.3"
) {
  throw new Error("The harness requires the published eve@0.71.3 package.");
}
const fixtureSource = path.resolve(
  root,
  process.argv[fixtureArgumentIndex] ?? "fixture"
);
const fixture = await mkdtemp(path.join(tmpdir(), "chatjs-eve-retirement-"));
await cp(fixtureSource, fixture, { recursive: true });
await symlink(
  path.join(root, "node_modules"),
  path.join(fixture, "node_modules")
);
await writeFile(
  path.join(fixture, "package.json"),
  '{"name":"retirement-fixture","type":"module","private":true,"dependencies":{"eve":"0.71.3","ai":"7.0.106"}}\n'
);
const worker = Bun.spawn(
  [
    node,
    path.join(root, "node_modules/eve/bin/eve.js"),
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
    cwd: fixture,
    env: {
      CI: "1",
      DOCKER_HOST: `unix://${fixture}/no-docker.sock`,
      EVE_MOCK_AUTHORED_MODELS: "0",
      HOME: fixture,
      NODE_ENV: "development",
      PATH: `${path.dirname(node)}:${searchPath}`,
      TMPDIR: tmpdir(),
    },
    stderr: "inherit",
    stdout: "inherit",
    timeout: 180_000,
  }
);
const exitCode = await worker.exited;
if (exitCode !== successExitCode) {
  throw new Error(
    `Runtime proof failed (${exitCode}); disposable evidence retained at ${fixture}`
  );
}
await rm(fixture, { force: true, recursive: true });
