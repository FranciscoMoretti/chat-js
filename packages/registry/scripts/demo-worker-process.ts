import { spawn } from "node:child_process";

/** Workers only write temporary output; terminate hung generation before releasing the writer lease. */
export const runDemoWorker = async (
  args: readonly string[],
  cwd: string,
  timeoutMs = 60_000
): Promise<void> => {
  const worker = spawn(process.execPath, [...args], {
    cwd,
    detached: true,
    stdio: "inherit",
  });
  const completed = Promise.withResolvers<boolean>();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (worker.pid !== undefined) {
      try {
        process.kill(-worker.pid, "SIGKILL");
      } catch (error) {
        if (
          !(error instanceof Error && "code" in error && error.code === "ESRCH")
        ) {
          completed.reject(error);
        }
      }
    }
  }, timeoutMs);
  worker.once("error", completed.reject);
  worker.once("close", (code) => {
    if (timedOut) {
      completed.reject(new Error(`Generator exceeded ${timeoutMs}ms deadline`));
    } else if (code === 0) {
      completed.resolve(true);
    } else {
      completed.reject(new Error(`Generator exited with ${code}`));
    }
  });
  try {
    await completed.promise;
  } finally {
    clearTimeout(timer);
  }
};
