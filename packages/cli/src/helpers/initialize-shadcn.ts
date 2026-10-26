import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { prepareScaffoldUi } from "./scaffold-ui";

// Native init owns theme validation, encoding, font transforms and component
// reinstallation. Its executable is public; its internal command modules are not.
export const initializeShadcn = async (
  cwd: string,
  args: readonly string[]
): Promise<void> => {
  if (args.length === 0) {
    return;
  }
  const executable = createRequire(import.meta.url).resolve("shadcn");
  const interactive = process.stdin.isTTY;
  const child = spawn(
    process.execPath,
    [
      executable,
      "init",
      "--preset",
      "rhea",
      "--no-monorepo",
      "--force",
      "--reinstall",
      "--yes",
      ...args,
    ],
    { cwd, stdio: [interactive ? "inherit" : "pipe", "pipe", "pipe"] }
  );
  // Native init prompts again on a library switch even with --yes. This runs
  // only against a fresh scaffold: confirm that owned source replacement while
  // preserving native option parsing, diagnostics, and generated components.
  let promptOutput = "";
  let confirmed = false;
  const forward = (chunk: Buffer, stream: NodeJS.WriteStream): void => {
    stream.write(chunk);
    promptOutput += chunk.toString();
    if (
      !interactive &&
      !confirmed &&
      promptOutput.includes("Would you like to continue?")
    ) {
      confirmed = true;
      child.stdin?.end("y\n");
    }
  };
  child.stdout?.on("data", (chunk: Buffer) => {
    forward(chunk, process.stdout);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    forward(chunk, process.stderr);
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
          `Native shadcn initialization failed (exit ${code}). See its diagnostic above. The scaffold remains at ${cwd}; no selected registry source was installed.`
        )
      );
    }
  });
  await promise;
  await prepareScaffoldUi(cwd);
};
