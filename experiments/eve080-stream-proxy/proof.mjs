import { z } from "zod";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "eve/client";

const here = import.meta.dirname;
const repo = path.resolve(here, "../..");
assert.equal(process.versions.node.split(".")[0], "24");
const app = await mkdtemp(path.join(tmpdir(), "eve080-stream-"));
await symlink(path.join(here, "node_modules"), path.join(app, "node_modules"));
await mkdir(path.join(app, "agent/channels"), { recursive: true });
await writeFile(
  path.join(app, "package.json"),
  JSON.stringify({
    type: "module",
    dependencies: { eve: "0.80.1", ai: "7.0.137" },
  })
);
await writeFile(
  path.join(app, "agent/agent.mjs"),
  "import {defineAgent} from 'eve'; import {mockModel} from 'eve/evals'; export default defineAgent({defaultTools:false,model:mockModel('stream proof complete')});"
);
await writeFile(
  path.join(app, "agent/instructions.md"),
  "Reply with the deterministic fixture response."
);
await writeFile(
  path.join(app, "agent/channels/eve.mjs"),
  "import {eveChannel} from 'eve/channels/eve'; export default eveChannel({auth:()=>({attributes:{},authenticator:'stream-fixture',principalId:'owner',principalType:'user'})});"
);
let logs = "";
const child = spawn(
  process.execPath,
  [
    path.join(here, "node_modules/eve/bin/eve.js"),
    "dev",
    "--no-ui",
    "--host",
    "127.0.0.1",
    "--port",
    "0",
    "--no-default-extensions",
  ],
  {
    cwd: app,
    env: {
      PATH: `${path.dirname(process.execPath)}:/opt/homebrew/bin:/usr/bin:/bin`,
      HOME: app,
      NODE_ENV: "development",
      EVE_MOCK_AUTHORED_MODELS: "0",
      DOCKER_HOST: `unix://${app}/no-docker.sock`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  }
);
child.stdout.on("data", (chunk) => {
  logs += chunk;
});
child.stderr.on("data", (chunk) => {
  logs += chunk;
});
try {
  const deadline = Date.now() + 90_000;
  let host;
  while (Date.now() < deadline) {
    host = /http:\/\/127\.0\.0\.1:\d+/u.exec(logs)?.[0];
    if (host !== undefined) {
      break;
    }
    if (child.exitCode !== null) {
      throw new Error("Backend exited");
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Poll one subprocess readiness barrier serially.
    await delay(100);
  }
  assert.ok(host !== undefined, "native dev server ready");
  const made = await new Client({ host }).sessions.create({ message: "hello" });
  await made.response.result();
  const { sessionId } = made.session.state;
  const test = spawn(
    process.execPath,
    [
      path.join(repo, "node_modules/vitest/vitest.mjs"),
      "run",
      "--config",
      path.join(here, "vitest.config.ts"),
    ],
    {
      cwd: repo,
      env: {
        ...process.env,
        EVE_STREAM_PROOF_HOST: host,
        EVE_STREAM_PROOF_SESSION: sessionId,
      },
      stdio: "inherit",
    }
  );
  const [code] = z
    .tuple([z.number().nullable(), z.string().nullable()])
    .parse(await once(test, "exit"));
  assert.equal(code, 0, "actual ChatJS proxy proof");
  await writeFile(
    path.join(here, "RESULTS.json"),
    `${JSON.stringify(
      {
        eve: "0.80.1",
        node: process.versions.node,
        host,
        sessionId,
        app,
        passed: true,
        scope:
          "Actual GET handler and relay; fixture principal/database/transport routing; real native HTTP backend. No full app pin or deployment.",
      },
      null,
      2
    )}\n`
  );
} finally {
  await writeFile(path.join(app, "server.log"), logs);
  if (child.exitCode === null && child.signalCode === null) {
    const stopped = once(child, "exit");
    child.kill("SIGTERM");
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 10_000);
    await stopped;
    clearTimeout(timer);
  }
  console.log(`Evidence: ${app}`);
}
