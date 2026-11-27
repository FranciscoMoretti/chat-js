import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { readUiBase } from "#cli/utils/ui-compatibility";

export const runNativeShadcn = async (
  cwd: string,
  args: readonly string[],
  interactive = false
): Promise<void> => {
  const executable = createRequire(import.meta.url).resolve("shadcn");
  const child = spawn(process.execPath, [executable, ...args], {
    cwd,
    stdio: interactive
      ? [process.stdin.isTTY ? "inherit" : "ignore", "inherit", "inherit"]
      : ["ignore", "pipe", "pipe"],
  });
  const { promise, resolve, reject }: PromiseWithResolvers<void> =
    Promise.withResolvers();
  const output: string[] = [];
  child.stdout?.on("data", (data) => {
    output.push(String(data));
  });
  child.stderr?.on("data", (data) => {
    output.push(String(data));
  });
  child.on("error", reject);
  child.on("close", (code) => {
    if (code === 0) {
      resolve();
    } else {
      const diagnostic = output.join("").trim();
      const status = code === null ? "interrupted" : `exit ${code}`;
      reject(
        new Error(
          `shadcn ${args[0]} failed (${status}).${diagnostic ? `\n${diagnostic}` : ""}`
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
  // An explicitly bare preset option hands control to shadcn's own picker.
  const pickPreset = args.some((argument, index) => {
    const next = args.at(index + 1);
    return (
      (argument === "--preset" || /^-[ys]*p$/u.test(argument)) &&
      (next === undefined || next.startsWith("-"))
    );
  });
  await runNativeShadcn(
    cwd,
    ["init", "--preset", "rhea", "--no-monorepo", "--yes", ...args],
    pickPreset
  );
  // Native can exit zero on cancellation/EOF. A usable config is required.
  if (!(await readUiBase(cwd))) {
    throw new Error(
      "Native shadcn initialization did not produce a supported Base/Radix configuration."
    );
  }
};
