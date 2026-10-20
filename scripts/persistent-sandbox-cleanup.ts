import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import {
  link,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import pathModule from "node:path";
import { promisify } from "node:util";
import { z } from "zod";

// oxlint-disable-next-line typescript/strict-void-return -- Node promisify uses execFile's custom promise implementation; its ChildProcess return is intentionally ignored.
const execute = promisify(execFile);
const appDirectory = existsSync(
  pathModule.join(process.cwd(), "chat.config.ts")
)
  ? process.cwd()
  : pathModule.join(process.cwd(), "apps/chat");
const directory = pathModule.join(appDirectory, ".eve/chatjs-cleanup");
const intent = z.object({
  pid: z.number().int().positive(),
  started: z.string(),
  runId: z.uuid(),
});
const deadline = 60_000;
const processStart = async (pid: number): Promise<string | null> => {
  try {
    const { stdout } = await execute(
      "ps",
      ["-p", String(pid), "-o", "lstart="],
      { timeout: 5000 }
    );
    if (stdout.trim()) {
      return stdout.trim();
    }
    throw new Error("Process start identity is unavailable.");
  } catch (error) {
    try {
      process.kill(pid, 0);
    } catch (probeError) {
      if (
        probeError instanceof Error &&
        "code" in probeError &&
        probeError.code === "ESRCH"
      ) {
        return null;
      }
    }
    throw new Error("Cannot confirm supervisor process identity.", {
      cause: error,
    });
  }
};
const stop = async (runId: string): Promise<void> => {
  await execute(
    process.execPath,
    [
      ...(process.versions.bun === undefined
        ? [
            "--import=tsx",
            "--env-file-if-exists=.env.local",
            "--env-file-if-exists=.env.worktree.local",
          ]
        : [
            "--tsconfig-override=tsconfig.json",
            "--env-file=.env.local",
            "--env-file=.env.worktree.local",
          ]),
      "scripts/stop-persistent-sandboxes.ts",
      runId,
    ],
    { cwd: appDirectory, timeout: deadline }
  );
};
export const finishPersistentSandboxCleanup = async (
  runId: string
): Promise<void> => {
  await stop(runId);
  await rm(pathModule.join(directory, `${runId}.json`), { force: true });
};
/** Never infer worker termination from supervisor death; preserve uncertain intents. */
export const preparePersistentSandboxCleanup = async (
  runId: string
): Promise<void> => {
  await mkdir(directory, { recursive: true });
  for (const name of await readdir(directory)) {
    if (!name.endsWith(".json")) {
      continue;
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Recover one dead run before starting another runtime.
    const content = await readFile(pathModule.join(directory, name), "utf-8");
    const saved = intent.parse(JSON.parse(content));
    if (name !== `${saved.runId}.json`) {
      throw new Error("Sandbox cleanup intent identity mismatch.");
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Verify process start identity before touching its resources.
    if ((await processStart(saved.pid)) === saved.started) {
      continue;
    }
    throw new Error(
      `Supervisor ${saved.runId} exited without confirming worker termination. Stop its workers and reconcile its cleanup intent before restarting.`
    );
  }
  const started = await processStart(process.pid);
  if (started === null) {
    throw new Error("Supervisor identity unavailable.");
  }
  const temporary = pathModule.join(directory, `${runId}.tmp`);
  await writeFile(
    temporary,
    JSON.stringify({ pid: process.pid, started, runId }),
    {
      flag: "wx",
    }
  );
  try {
    // Link publishes the complete file atomically without overwriting an intent.
    await link(temporary, pathModule.join(directory, `${runId}.json`));
  } finally {
    await rm(temporary, { force: true });
  }
};
