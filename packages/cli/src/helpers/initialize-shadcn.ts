import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { readUiBase } from "#cli/utils/ui-compatibility";

export const runNativeShadcn = async (
  cwd: string,
  args: readonly string[]
): Promise<void> => {
  const executable = createRequire(import.meta.url).resolve("shadcn");
  const child = spawn(process.execPath, [executable, ...args], {
    cwd,
    stdio: [process.stdin.isTTY ? "inherit" : "ignore", "inherit", "inherit"],
  });
  const { promise, resolve, reject }: PromiseWithResolvers<void> =
    Promise.withResolvers();
  child.on("error", reject);
  child.on("close", (code) => {
    if (code === 0) {
      resolve();
    } else {
      reject(
        new Error(
          `Native shadcn ${args[0]} failed (exit ${code}). See its diagnostic above.`
        )
      );
    }
  });
  await promise;
};

// Native init owns all visual options. Defaults precede the unmodified argument
// sequence, so native parsing keeps the user's last option authoritative.
export const initializeShadcn = async (
  cwd: string,
  args: readonly string[]
): Promise<void> => {
  await runNativeShadcn(cwd, [
    "init",
    "--preset",
    "rhea",
    "--no-monorepo",
    "--yes",
    ...args,
  ]);
  // Native can exit zero on cancellation/EOF. A usable config is required.
  if (!(await readUiBase(cwd))) {
    throw new Error(
      "Native shadcn initialization did not produce a supported Base/Radix configuration."
    );
  }
};
