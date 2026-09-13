import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

if (process.platform !== "darwin")
  throw new Error("This local service uses macOS launchd.");
const root = resolve(import.meta.dir, "..");
const id = createHash("sha256").update(root).digest("hex").slice(0, 12);
const label = `com.chatjs.dev.${id}`;
const target = `gui/${process.getuid?.()}`;
const plist = join(homedir(), "Library/LaunchAgents", `${label}.plist`);
const logs = join(homedir(), "Library/Logs/ChatJS", id);
const action = process.argv[2] ?? "status";
function ctl(...args: string[]) {
  return execFileSync("launchctl", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
async function stop() {
  try {
    ctl("bootout", `${target}/${label}`);
  } catch {
    /* Not loaded. */
  }
  for (let i = 0; i < 30; i++) {
    try {
      ctl("print", `${target}/${label}`);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Service is still stopping; retry shortly.");
}
const xml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
if (action === "start") {
  // Check before writing the plist or stopping an existing healthy service.
  const [node, version] = execFileSync(
    "node",
    ["-p", "process.execPath + '\\n' + process.versions.node"],
    { encoding: "utf8" }
  )
    .trim()
    .split("\n");
  const major = Number(version?.split(".")[0]);
  if (!node || !Number.isInteger(major) || major < 24) {
    throw new Error(
      `ChatJS with Eve requires Node.js >=24; the current shell resolves ${version ?? "an unknown version"}. Select Node 24 or newer on PATH and retry. The existing service has not been changed.`
    );
  }
  mkdirSync(dirname(plist), { recursive: true });
  mkdirSync(logs, { recursive: true });
  writeFileSync(
    plist,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>run</string><string>dev:supervise</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(`${dirname(node)}:${dirname(process.execPath)}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`)}</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>10</integer>
<key>StandardOutPath</key><string>${xml(join(logs, "runtime.log"))}</string>
<key>StandardErrorPath</key><string>${xml(join(logs, "error.log"))}</string>
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
} else throw new Error("Use start, stop or status.");
