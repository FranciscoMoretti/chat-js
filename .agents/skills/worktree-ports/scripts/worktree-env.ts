#!/usr/bin/env bun

import { spawn } from "bun";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { loadWorktreeConfig, resolveWorktreeRuntime } from "./worktree-runtime";
/* oxlint-enable sort-imports */

const ARGUMENT_START_INDEX = 2;
const FIRST_ARGUMENT_INDEX = 0;
const SECOND_ARGUMENT_INDEX = 1;
const COMMAND_ARGUMENT_INDEX = 0;
const ARGUMENTS_TO_REMOVE = 1;
const EMPTY_ARGUMENT_COUNT = 0;
const JSON_INDENT_SPACES = 2;
const SUCCESS_EXIT_CODE = 0;
const FAILURE_EXIT_CODE = 1;
const args = process.argv.slice(ARGUMENT_START_INDEX);
const configFile = ".worktree-env.json";
// oxlint-disable-next-line node/no-top-level-await -- This Bun executable loads its worktree configuration before spawning the requested command.
const config = await loadWorktreeConfig(configFile);
// This CLI resolves the ambient slot setting before forwarding its validated app environment.
// oxlint-disable-next-line node/no-process-env -- The CLI boundary reads the configured slot from this process environment.
const runtime = resolveWorktreeRuntime(config, process.env);

const fail: (message: string) => never = (message) => {
  // oxlint-disable-next-line eslint/no-console -- The operator-facing failure diagnostic must stay on stderr.
  console.error(message);
  process.exit(FAILURE_EXIT_CODE);
};

// oxlint-disable-next-line eslint/no-console -- The status output is the CLI's documented human and --info output channel.
const writeStatus = (message: string): void => console.log(message);

if (args[FIRST_ARGUMENT_INDEX] === "--info") {
  const info = { ...runtime, configFile };
  if (args[SECOND_ARGUMENT_INDEX] === "--json") {
    // JSON.stringify treats a null replacer as absent; the third argument controls indentation.
    // oxlint-disable-next-line unicorn/no-null -- Use the native serializer without a filtering replacer for the CLI's JSON output.
    writeStatus(JSON.stringify(info, null, JSON_INDENT_SPACES));
  } else {
    writeStatus(`Worktree slot ${runtime.slot}`);
    for (const [name, app] of Object.entries(runtime.apps)) {
      writeStatus(`${name}: ${app.url} (port ${app.port})`);
    }
  }
  process.exit(SUCCESS_EXIT_CODE);
}

const appName = args.shift();
if (typeof appName !== "string" || appName.length === EMPTY_ARGUMENT_COUNT) {
  fail("Usage: worktree-env <app> -- <command>");
}

const app = runtime.apps[appName];
if (!Object.hasOwn(runtime.apps, appName)) {
  fail(
    `Unknown worktree app "${appName}". Expected one of: ${Object.keys(runtime.apps).join(", ")}`
  );
}

if (args[FIRST_ARGUMENT_INDEX] === "--") {
  args.splice(FIRST_ARGUMENT_INDEX, ARGUMENTS_TO_REMOVE);
}
if (args.length === EMPTY_ARGUMENT_COUNT) {
  fail("worktree-env requires a command to run");
}

writeStatus(`Worktree slot ${runtime.slot} · ${appName} → ${app.url}`);

const spawnChild = (
  commandArgs: readonly string[],
  environment: Readonly<Record<string, string | undefined>>
): ReturnType<typeof spawn> => {
  try {
    return spawn([...commandArgs], {
      env: { ...environment },
      stderr: "inherit",
      stdin: "inherit",
      stdout: "inherit",
    });
  } catch (error) {
    return fail(
      `Failed to start "${commandArgs[COMMAND_ARGUMENT_INDEX]}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

// Forward ambient variables for commands that rely on inherited setup alongside app-specific overrides.
// oxlint-disable-next-line node/no-process-env -- Child processes inherit this CLI's environment and receive validated app exports.
const childEnvironment = { ...process.env, ...app.env };
const child = spawnChild(args, childEnvironment);

process.on("SIGTERM", () => child.kill("SIGTERM"));

// oxlint-disable-next-line node/no-top-level-await -- This Bun executable forwards the child exit status only after that process has exited.
process.exit(await child.exited);
