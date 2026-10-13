import { cp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

const successExitCode = 0;
const minimumNodeMajor = 24;
const node = process.env.EVE_TEST_NODE;
if (typeof node !== "string" || node === "") {
  throw new Error("Set EVE_TEST_NODE to Node >=24");
}
const versionProcess = Bun.spawn([node, "--version"], { stdout: "pipe" });
const version = await new Response(versionProcess.stdout).text();
if (
  (await versionProcess.exited) !== successExitCode ||
  Number(/^v(?<major>\d+)/u.exec(version)?.groups?.major) < minimumNodeMajor
) {
  throw new Error("Node >=24 is required");
}
const area = path.resolve("apps/chat/.eve/lane-c-eval");
await mkdir(area, { recursive: true });
const fixture = path.resolve(area, crypto.randomUUID());
await cp(
  path.resolve("experiments/eve-delivery-correlation/fixture"),
  fixture,
  {
    recursive: true,
  }
);
await symlink(
  path.resolve(
    process.env.CORRELATION_PATCHED === "1"
      ? "apps/chat/.eve/lane-c-deps/node_modules"
      : "apps/chat/.eve/lane-c-stock-deps/node_modules"
  ),
  path.resolve(fixture, "node_modules")
);
await writeFile(
  path.resolve(fixture, "package.json"),
  JSON.stringify({
    dependencies: { ai: "7.0.106", eve: "0.71.3" },
    private: true,
    type: "module",
  })
);
await writeFile(
  path.resolve(fixture, "evals/expected.ts"),
  `const patched = ${process.env.CORRELATION_PATCHED === "1"};\nexport {patched};\n`
);
const worker = Bun.spawn(
  [
    node,
    path.resolve(fixture, "node_modules/eve/bin/eve.js"),
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
      PATH: `${path.dirname(node)}:${process.env.PATH}`,
      TMPDIR: area,
    },
    stderr: "inherit",
    stdout: "inherit",
  }
);
const code = await worker.exited;
if (code !== successExitCode) {
  throw new Error(`Proof failed (${code}); evidence: ${fixture}`);
}
await rm(fixture, { force: true, recursive: true });
