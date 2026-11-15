import type { ExecutionSandbox } from "./types";

/** Quote each argument as data; snippets must never become shell syntax. */
export const runCodeCommand = async (
  sandbox: Readonly<ExecutionSandbox>,
  signal: AbortSignal,
  command: string,
  args: readonly string[] = []
) =>
  await sandbox.run({
    command: [command, ...args]
      .map((value) => `'${value.replaceAll("'", "'\"'\"'")}'`)
      .join(" "),
    signal,
  });
