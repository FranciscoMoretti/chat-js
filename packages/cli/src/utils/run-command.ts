// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI launches package-manager, Git, or command subprocesses through native process APIs.
import { spawn } from "node:child_process";

const EXIT_SUCCESS = 0;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve runCommand's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/no-undefined -- The completion-only child-process promise uses Promise.withResolvers<undefined> and resolves its close event with that exact value. */
export const runCommand = async (
  command: string,
  args: readonly string[],
  cwd: string
): Promise<void> => {
  const { promise, resolve, reject } = Promise.withResolvers<undefined>();
  const child = spawn(command, args, { cwd, stdio: "pipe" });
  const stderr: string[] = [];
  child.stderr?.on("data", (data) => {
    stderr.push(String(data));
  });
  child.on("error", reject);
  child.on("close", (code) => {
    if (code === EXIT_SUCCESS) {
      resolve(undefined);
    } else {
      reject(
        new Error(
          `${command} exited with code ${code}\n${stderr.join("")}`.trim()
        )
      );
    }
  });
  await promise;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/no-undefined */
