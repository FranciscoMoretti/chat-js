import { spawn } from "node:child_process";

export const runCommand = async (
  command: string,
  args: string[],
  cwd: string
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "pipe" });
    const stderr: string[] = [];
    child.stderr?.on("data", (data) => {
      stderr.push(String(data));
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `${command} exited with code ${code}\n${stderr.join("")}`.trim()
          )
        );
      }
    });
  });
};
