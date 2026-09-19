import { spawn } from "node:child_process";

export const runCommand = async (
  command: string,
  args: string[],
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
    if (code === 0) {
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
