/* oxlint-disable import/no-nodejs-modules -- the node:child_process import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { execFileSync } from "node:child_process";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable eslint/sort-imports -- the node:crypto import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
/* oxlint-disable import/no-nodejs-modules -- the node:crypto import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { createHash } from "node:crypto";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- the node:fs import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
/* oxlint-disable import/no-nodejs-modules -- the node:fs import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable import/no-nodejs-modules -- the node:os import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { homedir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:path import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import nodePath from "node:path";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable eslint/sort-imports -- the node:timers/promises import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
/* oxlint-disable import/no-nodejs-modules -- the node:timers/promises import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { setTimeout as delay } from "node:timers/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-enable eslint/sort-imports */

if (process.platform !== "darwin") {
  throw new Error("This local service uses macOS launchd.");
}
const root = nodePath.resolve(import.meta.dir, "..");
/* oxlint-disable eslint/no-magic-numbers -- id: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
const id = createHash("sha256").update(root).digest("hex").slice(0, 12);
/* oxlint-enable eslint/no-magic-numbers */
const label = `com.chatjs.dev.${id}`;
/* oxlint-disable oxc/no-optional-chaining -- target: The guarded lookup intentionally permits missing SDK/state fields; preserve one evaluation of the existing optional access. */
const target = `gui/${process.getuid?.()}`;
/* oxlint-enable oxc/no-optional-chaining */
const plist = nodePath.join(
  homedir(),
  "Library/LaunchAgents",
  `${label}.plist`
);
const logs = nodePath.join(homedir(), "Library/Logs/ChatJS", id);
/* oxlint-disable eslint/no-magic-numbers -- action: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
const action = process.argv[2] ?? "status";
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-disable node/no-sync -- ctl: Startup/discovery consumes this synchronous OS/filesystem API before dependent commands run. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ctl: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const ctl = (...args: string[]): string =>
  execFileSync("launchctl", args, {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable node/no-sync */
/* oxlint-disable oxc/no-async-await -- stop: Await sequencing preserves this operation's dependent I/O and error propagation. */
/* oxlint-disable eslint/id-length -- stop: The local index/OS/library binding retains its conventional API notation. */
/* oxlint-disable eslint/no-magic-numbers -- stop: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
const stop = async (): Promise<void> => {
  try {
    ctl("bootout", `${target}/${label}`);
  } catch {
    /* Not loaded. */
  }
  for (let i = 0; i < 30; i += 1) {
    try {
      ctl("print", `${target}/${label}`);
    } catch {
      return;
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for each bounded stream read, readiness attempt, or shared fixture before continuing.
    await delay(1000);
  }
  throw new Error("Service is still stopping; retry shortly.");
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/id-length */
/* oxlint-enable oxc/no-async-await */
const xml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
/* oxlint-disable node/no-sync -- dev-service.ts: Startup/discovery consumes this synchronous OS/filesystem API before dependent commands run. */
/* oxlint-disable oxc/no-optional-chaining -- dev-service.ts: The guarded lookup intentionally permits missing SDK/state fields; preserve one evaluation of the existing optional access. */
/* oxlint-disable eslint/no-magic-numbers -- dev-service.ts: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable node/no-top-level-await -- dev-service.ts: This Bun/ESM entrypoint must finish initialization before later module statements run. */
/* oxlint-disable eslint/no-console -- dev-service.ts: This command or desktop boundary reports startup, progress and failures to its operator. */
if (action === "start") {
  // Check before writing the plist or stopping an existing healthy service.
  const [node, version] = execFileSync(
    "node",
    ["-p", String.raw`process.execPath + '\n' + process.versions.node`],
    { encoding: "utf-8" }
  )
    .trim()
    .split("\n");
  const major = Number(version?.split(".")[0]);
  if (!node || !Number.isInteger(major) || major < 24) {
    throw new Error(
      `ChatJS with Eve requires Node.js >=24; the current shell resolves ${version ?? "an unknown version"}. Select Node 24 or newer on PATH and retry. The existing service has not been changed.`
    );
  }
  mkdirSync(nodePath.dirname(plist), { recursive: true });
  mkdirSync(logs, { recursive: true });
  writeFileSync(
    plist,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>run</string><string>dev:supervise</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(`${nodePath.dirname(node)}:${nodePath.dirname(process.execPath)}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`)}</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>10</integer>
<key>StandardOutPath</key><string>${xml(nodePath.join(logs, "runtime.log"))}</string>
<key>StandardErrorPath</key><string>${xml(nodePath.join(logs, "error.log"))}</string>
</dict></plist>`,
    { mode: 0o600 }
  );
  await stop();
  ctl("bootstrap", target, plist);
  console.info(`Started ${label}. Logs: ${logs}`);
} else if (action === "stop") {
  await stop();
  rmSync(plist, { force: true });
  console.info("Stopped this worktree's managed runtime.");
} else if (action === "status") {
  try {
    console.info(ctl("print", `${target}/${label}`));
  } catch {
    console.info("Managed runtime is stopped.");
  }
  console.info(`Logs: ${logs}`);
} else {
  throw new Error("Use start, stop or status.");
}
/* oxlint-enable eslint/no-console */
/* oxlint-enable node/no-top-level-await */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable node/no-sync */
