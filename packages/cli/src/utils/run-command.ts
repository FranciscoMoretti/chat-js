import { spawn } from "node:child_process";

export async function runCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, stdio: "pipe" });
    const stderr: string[] = [];
    child.stderr?.on("data", (data) => {
      stderr.push(String(data));
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else
        rejectPromise(
          new Error(
            `${command} exited with code ${code}\n${stderr.join("")}`.trim()
          )
        );
    });
  });
}
