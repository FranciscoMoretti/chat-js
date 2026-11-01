/* eslint-disable no-await-in-loop -- Startup readiness polling must be sequential. */
// Opt-in network integration. Run only against a disposable generated app.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import postgres from "postgres";
import { installActivityFixture } from "./native-activity-fixture";
import { checkNativeRuntime } from "./native-runtime-browser";

const FIRST_ARGUMENT = 2;
const POLL_INTERVAL = 500;
const STARTUP_TIMEOUT = 600_000;
const PROCESS_TIMEOUT = 180_000;
const SECRET_BYTES = 32;
const DB_SUFFIX_BYTES = 8;
const EXIT_SUCCESS = 0;
const app = await realpath(process.argv[FIRST_ARGUMENT] ?? "");
assert.match(
  app,
  /^\/(?:private\/)?tmp\/chatjs-native-create-[^/]+\/app$/u,
  "Runtime verification requires a generated /tmp/chatjs-native-create-*/app fixture"
);
const output = path.join(app, "..", "runtime");
await mkdir(output, { recursive: true });
const configuredDatabase =
  process.env.CHATJS_NATIVE_POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
assert.ok(
  URL.canParse(configuredDatabase),
  "Set CHATJS_NATIVE_POSTGRES_URL or DATABASE_URL to a loopback Postgres connection."
);
const adminUrl = new URL(configuredDatabase);
assert.ok(["postgres:", "postgresql:"].includes(adminUrl.protocol));
assert.ok(
  ["127.0.0.1", "localhost", "[::1]"].includes(adminUrl.hostname),
  "Refusing to create or migrate databases on a non-loopback server"
);
adminUrl.pathname = "/postgres";
const databaseName = `chatjs_native_${randomBytes(DB_SUFFIX_BYTES).toString("hex")}`;
const databaseUrl = new URL(adminUrl);
databaseUrl.pathname = `/${databaseName}`;
const admin = postgres(adminUrl.href, { max: 1, connect_timeout: 10 });
const probe = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  fetch: () => new Response(),
});
const { port } = probe;
await probe.stop(true);
const baseUrl = `http://localhost:${port}`;
const minimal = process.env.CHATJS_NATIVE_SCENARIO === "minimal";
const uploads = process.env.CHATJS_NATIVE_SCENARIO === "uploads";
const live = !uploads && process.env.CHATJS_NATIVE_LIVE === "1";
if (live) {
  assert.ok(
    process.env.AI_GATEWAY_API_KEY !== undefined &&
      process.env.AI_GATEWAY_API_KEY !== "",
    "Live verification requires AI_GATEWAY_API_KEY"
  );
}
// Forward only the credentials needed by this specific case. Never inherit a
// Vercel deployment, shared workflow database, storage token, or production URL.
const env: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  NODE_ENV: "development",
  NEXT_TELEMETRY_DISABLED: "1",
  PORT: String(port),
  APP_URL: baseUrl,
  EVE_INTERNAL_ORIGIN: baseUrl,
  AUTH_SECRET: randomBytes(SECRET_BYTES).toString("hex"),
  EVE_GATEWAY_SECRET: randomBytes(SECRET_BYTES).toString("hex"),
  DATABASE_URL: databaseUrl.href,
  DATABASE_MIGRATION_URL: databaseUrl.href,
  WORKFLOW_POSTGRES_URL: databaseUrl.href,
  AUTH_GITHUB_ID: "local-runtime-verification",
  AUTH_GITHUB_SECRET: "local-runtime-verification",
  AI_GATEWAY_API_KEY: live
    ? process.env.AI_GATEWAY_API_KEY
    : "local-runtime-verification",
  OPENROUTER_API_KEY: "local-runtime-verification",
  MCP_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  AWS_REGION: "us-east-1",
};

const runSetup = async (): Promise<void> => {
  const log = createWriteStream(path.join(output, "setup.log"), {
    mode: 0o600,
  });
  try {
    const child = spawn("bun", ["run", "setup"], {
      cwd: app,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: PROCESS_TIMEOUT,
    });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    await once(child, "exit");
    assert.equal(
      child.exitCode,
      EXIT_SUCCESS,
      `Generated app setup failed; inspect ${output}/setup.log`
    );
  } finally {
    log.end();
  }
};

const waitForServer = async (server: ChildProcess): Promise<void> => {
  const deadline = Date.now() + STARTUP_TIMEOUT;
  while (Date.now() < deadline) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(
        `Generated app exited before readiness; inspect ${output}/server.log`
      );
    }
    try {
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(PROCESS_TIMEOUT),
      });
      if (response.ok) {
        return;
      }
    } catch {
      // Initial compilation and the embedded EVE worker both need to start.
    }
    await delay(POLL_INTERVAL);
  }
  throw new Error(
    `Generated app did not become ready; inspect ${output}/server.log`
  );
};

let created = false;
try {
  await admin.unsafe(`CREATE DATABASE ${databaseName}`);
  created = true;
  await installActivityFixture(app);
  await runSetup();
  const log = createWriteStream(path.join(output, "server.log"), {
    mode: 0o600,
  });
  const server = spawn("bun", ["run", "dev"], {
    cwd: app,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.pipe(log, { end: false });
  server.stderr.pipe(log, { end: false });
  try {
    await waitForServer(server);
    console.log(
      `Generated app running at ${baseUrl}; checking browser behavior.`
    );
    const report = await checkNativeRuntime({
      app,
      baseUrl,
      output,
      live,
      uploads,
      documents: !minimal,
      createUrl: process.env.CHATJS_CREATE_URL,
      preset: process.env.CHATJS_NATIVE_PRESET ?? "b27I2r8C",
      uiBase: process.env.CHATJS_NATIVE_BASE === "radix" ? "radix" : "base",
    });
    await writeFile(
      path.join(output, "report.json"),
      JSON.stringify(report, null, 2)
    );
    console.log(`Generated app runtime passed; evidence: ${output}`);
  } finally {
    if (server.pid !== undefined) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        /* Already exited. */
      }
      await delay(POLL_INTERVAL);
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {
        /* Already exited. */
      }
    }
    log.end();
  }
} finally {
  if (created) {
    await admin.unsafe(`DROP DATABASE ${databaseName} WITH (FORCE)`);
  }
  await admin.end();
}
