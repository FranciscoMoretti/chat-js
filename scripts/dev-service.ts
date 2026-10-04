import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import nodePath from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const SERVICE_ID_LENGTH = 12;
const HASH_PREFIX_START = 0;
const COMMAND_ARGUMENT_INDEX = 2;
const MAX_STOP_ATTEMPTS = 30;
const FIRST_STOP_ATTEMPT = 0;
const STOP_ATTEMPT_INCREMENT = 1;
const STOP_POLL_INTERVAL_MS = 1000;
const MIN_NODE_MAJOR_VERSION = 24;
const MAJOR_VERSION_SEGMENT_INDEX = 0;
const LAUNCH_AGENT_FILE_MODE = 0o600;
const NODE_VERSION_COMMAND = [
  "-p",
  String.raw`process.execPath + '\n' + process.versions.node`,
];
const NODE_VERSION_COMMAND_OUTPUT = "utf-8";
const execFileAsync: (
  file: string,
  args: readonly string[],
  options: Readonly<{ encoding: "utf-8" }>
) => Promise<{ stdout: string; stderr: string }> =
  // oxlint-disable-next-line typescript/strict-void-return -- `promisify(execFile)` exposes stdout/stderr while retaining the direct executable invocation.
  promisify(execFile);

interface ServiceOperations {
  readonly run: (file: string, args: readonly string[]) => Promise<string>;
  readonly mkdir: (path: string) => Promise<unknown>;
  readonly writeFile: (
    path: string,
    data: string,
    mode: number
  ) => Promise<unknown>;
  readonly removeFile: (path: string) => Promise<unknown>;
  readonly wait: (milliseconds: number) => Promise<unknown>;
  readonly log: (message: string) => void;
}

const nativeOperations: ServiceOperations = {
  // oxlint-disable-next-line eslint/no-console -- These are operator-facing CLI status and lifecycle messages.
  log: (message) => console.info(message),
  mkdir: async (path) => {
    await mkdir(path, { recursive: true });
  },
  removeFile: async (path) => {
    await rm(path, { force: true });
  },
  run: async (file, args): Promise<string> => {
    const result = await execFileAsync(file, args, {
      encoding: NODE_VERSION_COMMAND_OUTPUT,
    });
    return result.stdout;
  },
  wait: async (milliseconds) => await delay(milliseconds),
  writeFile: async (path, data, mode) => {
    await writeFile(path, data, { mode });
  },
};

const xml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

interface ServiceContext {
  readonly root: string;
  readonly id: string;
  readonly label: string;
  readonly target: string;
  readonly plist: string;
  readonly logs: string;
}

const createContext = (): ServiceContext => {
  const root = nodePath.resolve(import.meta.dir, "..");
  const id = createHash("sha256")
    .update(root)
    .digest("hex")
    .slice(HASH_PREFIX_START, SERVICE_ID_LENGTH);
  const label = `com.chatjs.dev.${id}`;
  const target = `gui/${process.getuid?.()}`;
  const plist = nodePath.join(
    homedir(),
    "Library/LaunchAgents",
    `${label}.plist`
  );
  const logs = nodePath.join(homedir(), "Library/Logs/ChatJS", id);
  return { id, label, logs, plist, root, target };
};

const launchctl = async (
  operations: ServiceOperations,
  ...args: readonly string[]
): Promise<string> => await operations.run("launchctl", args);

const stopService = async (
  context: ServiceContext,
  operations: ServiceOperations
): Promise<void> => {
  try {
    await launchctl(
      operations,
      "bootout",
      `${context.target}/${context.label}`
    );
  } catch {
    /* Not loaded. */
  }
  for (
    let stopAttempt = FIRST_STOP_ATTEMPT;
    stopAttempt < MAX_STOP_ATTEMPTS;
    stopAttempt += STOP_ATTEMPT_INCREMENT
  ) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Poll launchd one request at a time to preserve stop completion ordering.
      await launchctl(
        operations,
        "print",
        `${context.target}/${context.label}`
      );
    } catch {
      return;
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- launchd readiness checks must stay sequential until the service is released.
    await operations.wait(STOP_POLL_INTERVAL_MS);
  }
  throw new Error("Service is still stopping; retry shortly.");
};

const createPlist = (
  context: ServiceContext,
  node: string
): string => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${context.label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>run</string><string>dev:supervise</string></array>
<key>WorkingDirectory</key><string>${xml(context.root)}</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(`${nodePath.dirname(node)}:${nodePath.dirname(process.execPath)}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`)}</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>10</integer>
<key>StandardOutPath</key><string>${xml(nodePath.join(context.logs, "runtime.log"))}</string>
<key>StandardErrorPath</key><string>${xml(nodePath.join(context.logs, "error.log"))}</string>
</dict></plist>`;

const checkNodeVersion = async (
  operations: ServiceOperations
): Promise<string> => {
  const output = await operations.run("node", NODE_VERSION_COMMAND);
  const [node, version] = output.trim().split("\n");
  const major = Number(version?.split(".")[MAJOR_VERSION_SEGMENT_INDEX]);
  if (!node || !Number.isInteger(major) || major < MIN_NODE_MAJOR_VERSION) {
    throw new Error(
      `ChatJS with Eve requires Node.js >=24; the current shell resolves ${version ?? "an unknown version"}. Select Node 24 or newer on PATH and retry. The existing service has not been changed.`
    );
  }
  return node;
};

const startService = async (
  context: ServiceContext,
  operations: ServiceOperations
): Promise<void> => {
  // Check PATH before changing the current service.
  const node = await checkNodeVersion(operations);
  await operations.mkdir(nodePath.dirname(context.plist));
  await operations.mkdir(context.logs);
  await operations.writeFile(
    context.plist,
    createPlist(context, node),
    LAUNCH_AGENT_FILE_MODE
  );
  await stopService(context, operations);
  await launchctl(operations, "bootstrap", context.target, context.plist);
  operations.log(`Started ${context.label}. Logs: ${context.logs}`);
};

const stopAction = async (
  context: ServiceContext,
  operations: ServiceOperations
): Promise<void> => {
  await stopService(context, operations);
  await operations.removeFile(context.plist);
  operations.log("Stopped this worktree's managed runtime.");
};

const showStatus = async (
  context: ServiceContext,
  operations: ServiceOperations
): Promise<void> => {
  try {
    operations.log(
      await launchctl(operations, "print", `${context.target}/${context.label}`)
    );
  } catch {
    operations.log("Managed runtime is stopped.");
  }
  operations.log(`Logs: ${context.logs}`);
};

const runDevService = async (
  action: string,
  operations: ServiceOperations = nativeOperations,
  platform: NodeJS.Platform = process.platform
): Promise<void> => {
  if (platform !== "darwin") {
    throw new Error("This local service uses macOS launchd.");
  }
  const context = createContext();
  if (action === "start") {
    await startService(context, operations);
  } else if (action === "stop") {
    await stopAction(context, operations);
  } else if (action === "status") {
    await showStatus(context, operations);
  } else {
    throw new Error("Use start, stop or status.");
  }
};

if (import.meta.main) {
  const action = process.argv[COMMAND_ARGUMENT_INDEX] ?? "status";
  await runDevService(action);
}

export { runDevService };
