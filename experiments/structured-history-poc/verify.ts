import manifest from "./package.json";
/** Run the throwaway agent outside the monorepo; no dev watchers or app database. */
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = import.meta.dirname;
const fixture = await mkdtemp(
  path.join(tmpdir(), "chatjs-structured-history-")
);
const eveBin = path.join(root, "node_modules/eve/bin/eve.js");
const node = process.env.POC_NODE ?? "node";
const execute = async (args: readonly string[]): Promise<void> => {
  const child = spawn(node, [eveBin, ...args], {
    cwd: fixture,
    stdio: "inherit",
  });
  const result: unknown[] = await once(child, "exit");
  const [code] = result;
  if (code !== 0) {
    throw new Error(`EVE ${args[0]} exited with ${String(code)}`);
  }
};
const probe = createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const address = probe.address();
if (address === null || typeof address === "string") {
  throw new Error("Unable to allocate a local port.");
}
const { port } = address;
probe.close();
await once(probe, "close");
const url = `http://127.0.0.1:${port}`;
let worker: ReturnType<typeof spawn> | undefined;
try {
  for (const name of [
    "agent",
    "evals",
    "history-adapter.ts",
    "reservations.ts",
    "package.json",
  ]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Four small fixture inputs copied before compiling.
    await cp(path.join(root, name), path.join(fixture, name), {
      recursive: true,
    });
  }
  await symlink(
    path.join(root, "node_modules"),
    path.join(fixture, "node_modules")
  );
  const installed: unknown = JSON.parse(
    await readFile(path.join(root, "node_modules/eve/package.json"), "utf-8")
  );
  if (
    typeof installed !== "object" ||
    installed === null ||
    !("version" in installed)
  ) {
    throw new Error("Missing EVE package version.");
  }
  console.log("Locally patched EVE version:", installed.version);
  // eve recognizes projects by their manifest. Resolution still uses the linked local build.
  await writeFile(
    path.join(fixture, "package.json"),
    JSON.stringify({
      ...manifest,
      dependencies: { ...manifest.dependencies, eve: installed.version },
    })
  );
  await execute(["build"]);
  worker = spawn(
    node,
    [eveBin, "start", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: fixture,
      stdio: "inherit",
      env: { ...process.env, EVE_CHECK_SESSION_EVENTS: "1" },
    }
  );
  const deadline = Date.now() + 30_000;
  while (true) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bounded readiness polling for this disposable worker.
    const ready = await fetch(`${url}/eve/v1/health`)
      .then((response) => response.ok)
      .catch(() => false);
    if (ready) {
      break;
    }
    if (Date.now() > deadline) {
      throw new Error("PoC worker did not become ready.");
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bounded readiness polling for this disposable worker.
    await delay(100);
  }
  await execute(["eval", "--url", url, "--strict", "--verbose"]);
} finally {
  if (worker !== undefined && worker.exitCode === null) {
    worker.kill("SIGTERM");
    await once(worker, "exit");
  }
  await rm(fixture, { recursive: true, force: true });
}
