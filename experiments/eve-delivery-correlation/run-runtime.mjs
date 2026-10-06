import { cp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
const node = process.env.EVE_TEST_NODE;
if (!node) throw new Error("Set EVE_TEST_NODE to Node >=24");
const versionProcess = Bun.spawn([node, "--version"], { stdout: "pipe" });
const version = await new Response(versionProcess.stdout).text();
if (
  (await versionProcess.exited) !== 0 ||
  Number(/^v(\d+)/.exec(version)?.[1]) < 24
)
  throw new Error("Node >=24 is required");
const area = resolve("apps/chat/.eve/lane-c-eval");
await mkdir(area, { recursive: true });
const fixture = resolve(area, crypto.randomUUID());
await cp(resolve("experiments/eve-delivery-correlation/fixture"), fixture, {
  recursive: true,
});
await symlink(
  resolve(
    process.env.CORRELATION_PATCHED === "1"
      ? "apps/chat/.eve/lane-c-deps/node_modules"
      : "apps/chat/.eve/lane-c-stock-deps/node_modules"
  ),
  resolve(fixture, "node_modules")
);
await writeFile(
  resolve(fixture, "package.json"),
  JSON.stringify({
    type: "module",
    private: true,
    dependencies: { eve: "0.71.3", ai: "7.0.106" },
  })
);
await writeFile(
  resolve(fixture, "evals/expected.ts"),
  `export default ${process.env.CORRELATION_PATCHED === "1"};\n`
);
const worker = Bun.spawn(
  [
    node,
    resolve(fixture, "node_modules/eve/bin/eve.js"),
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
      PATH: `${dirname(node)}:${process.env.PATH}`,
      TMPDIR: area,
    },
    stdout: "inherit",
    stderr: "inherit",
  }
);
const code = await worker.exited;
if (code !== 0) throw new Error(`Proof failed (${code}); evidence: ${fixture}`);
await rm(fixture, { recursive: true, force: true });
