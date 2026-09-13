import { spawn } from "node:child_process";

/** Bound the entire operation, including pipes inherited by descendants. */
export function run(
  cwd: string,
  command: string[],
  timeoutMs = 180_000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const grouped = process.platform !== "win32";
    const child = spawn(command[0], command.slice(1), {
      cwd,
      detached: grouped,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const signal = (value: NodeJS.Signals) => {
      try {
        if (grouped && child.pid) process.kill(-child.pid, value);
        else child.kill(value);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") reject(error);
      }
    };
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => {
      timedOut = true;
      signal("SIGTERM");
      setTimeout(() => signal("SIGKILL"), 1000).unref();
      child.stdout.destroy();
      child.stderr.destroy();
      reject(
        new Error(
          `${command.join(" ")} timed out after ${timeoutMs}ms in ${cwd}`
        )
      );
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${command.join(" ")} failed in ${cwd}:\n${stdout}\n${stderr}`
          )
        );
    });
  });
}
