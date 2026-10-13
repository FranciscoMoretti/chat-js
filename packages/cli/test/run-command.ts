import { spawn } from "node:child_process";

const COMMAND_EXECUTABLE_INDEX = 0;
const COMMAND_ARGUMENTS_START_INDEX = 1;
const EMPTY_CHILD_PROCESS_ID = 0;
const DEFAULT_TIMEOUT_MS = 180_000;
const KILL_ESCALATION_DELAY_MS = 1000;
const SUCCESS_EXIT_CODE = 0;

/** Bound the entire operation, including pipes inherited by descendants. */
export const run = async (
  cwd: string,
  command: readonly string[],
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<void> => {
  const { promise, resolve, reject } = Promise.withResolvers<undefined>();
  const grouped = process.platform !== "win32";
  const child = spawn(
    command[COMMAND_EXECUTABLE_INDEX],
    command.slice(COMMAND_ARGUMENTS_START_INDEX),
    {
      cwd,
      detached: grouped,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const signal = (value: NodeJS.Signals): void => {
    try {
      if (
        grouped &&
        child.pid !== null &&
        child.pid !== undefined &&
        child.pid !== EMPTY_CHILD_PROCESS_ID &&
        !Number.isNaN(child.pid)
      ) {
        process.kill(-child.pid, value);
      } else {
        child.kill(value);
      }
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ESRCH")
      ) {
        reject(error);
      }
    }
  };
  child.stdout.on("data", (chunk): void => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk): void => {
    stderr += chunk;
  });
  const timer = setTimeout((): void => {
    timedOut = true;
    signal("SIGTERM");
    setTimeout((): void => {
      signal("SIGKILL");
    }, KILL_ESCALATION_DELAY_MS).unref();
    child.stdout.destroy();
    child.stderr.destroy();
    reject(
      new Error(`${command.join(" ")} timed out after ${timeoutMs}ms in ${cwd}`)
    );
  }, timeoutMs);
  child.on("error", (error: Readonly<Error>): void => {
    clearTimeout(timer);
    reject(error);
  });
  child.on("close", (code): void => {
    clearTimeout(timer);
    if (timedOut) {
      return;
    }
    if (code === SUCCESS_EXIT_CODE) {
      resolve();
    } else {
      reject(
        new Error(
          `${command.join(" ")} failed in ${cwd}:\n${stdout}\n${stderr}`
        )
      );
    }
  });
  await promise;
};
