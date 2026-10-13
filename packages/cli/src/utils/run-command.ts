import { spawn } from "node:child_process";

const EXIT_SUCCESS = 0;

export const runCommand = async (
  command: string,
  args: readonly string[],
  cwd: string
): Promise<void> => {
  const { promise, resolve, reject }: PromiseWithResolvers<void> =
    Promise.withResolvers();
  const child = spawn(command, args, { cwd, stdio: "pipe" });
  const stderr: string[] = [];
  child.stderr.on("data", (data) => {
    stderr.push(String(data));
  });
  child.on("error", reject);
  child.on("close", (code) => {
    if (code === EXIT_SUCCESS) {
      resolve();
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
