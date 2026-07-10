#!/usr/bin/env bun

import { resolveDevRuntime } from "./dev-runtime";

const command = process.argv.slice(2);

if (command.length === 0) {
  throw new Error("with-dev-slot requires a command to run");
}

const runtime = resolveDevRuntime(process.env.CHATJS_DEV_SLOT);

console.log(`ChatJS dev slot ${runtime.slot} → ${runtime.origin}`);

const child = Bun.spawn(command, {
  env: {
    ...process.env,
    APP_URL: runtime.origin,
    ELECTRON_APP_URL: runtime.origin,
    PORT: String(runtime.port),
  },
  stderr: "inherit",
  stdin: "inherit",
  stdout: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child.kill(signal));
}

process.exit(await child.exited);
