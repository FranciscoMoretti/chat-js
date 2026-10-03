#!/usr/bin/env bun

import { spawn } from "bun";

import { loadWorktreeConfig, resolveWorktreeRuntime } from "./worktree-runtime";

/* oxlint-disable eslint/no-magic-numbers -- args: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
const args = process.argv.slice(2);
/* oxlint-enable eslint/no-magic-numbers */
const configFile = ".worktree-env.json";
const config = await loadWorktreeConfig(configFile);
/* oxlint-disable node/no-process-env -- runtime: This process boundary owns environment loading/forwarding; consumers receive the resulting validated configuration. */
const runtime = resolveWorktreeRuntime(config, process.env);
/* oxlint-enable node/no-process-env */

/* oxlint-disable eslint/no-console -- fail: This command or desktop boundary reports startup, progress and failures to its operator. */
/* oxlint-disable eslint/no-magic-numbers -- fail: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
const fail: (message: string) => never = (message) => {
  console.error(message);
  process.exit(1);
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-console */

/* oxlint-disable eslint/no-magic-numbers -- worktree-env.ts: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable eslint/no-console -- worktree-env.ts: This command or desktop boundary reports startup, progress and failures to its operator. */
/* oxlint-disable unicorn/no-null -- worktree-env.ts: The SDK/wire/OS contract uses null as an explicit absence value. */
if (args[0] === "--info") {
  const info = { ...runtime, configFile };
  if (args[1] === "--json") {
    console.log(JSON.stringify(info, null, 2));
  } else {
    console.log(`Worktree slot ${runtime.slot}`);
    for (const [name, app] of Object.entries(runtime.apps)) {
      console.log(`${name}: ${app.url} (port ${app.port})`);
    }
  }
  process.exit(0);
}
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-console */
/* oxlint-enable eslint/no-magic-numbers */

const appName = args.shift();
/* oxlint-disable typescript/strict-boolean-expressions -- worktree-env.ts: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
if (!appName) {
  fail("Usage: worktree-env <app> -- <command>");
}
/* oxlint-enable typescript/strict-boolean-expressions */

const app = runtime.apps[appName];
/* oxlint-disable typescript/strict-boolean-expressions -- worktree-env.ts: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
if (!app) {
  fail(
    `Unknown worktree app "${appName}". Expected one of: ${Object.keys(runtime.apps).join(", ")}`
  );
}
/* oxlint-enable typescript/strict-boolean-expressions */

/* oxlint-disable eslint/no-magic-numbers -- worktree-env.ts: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
if (args[0] === "--") {
  args.shift();
}
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-disable eslint/no-magic-numbers -- worktree-env.ts: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
if (args.length === 0) {
  fail("worktree-env requires a command to run");
}
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/no-console -- worktree-env.ts: This command or desktop boundary reports startup, progress and failures to its operator. */
console.log(`Worktree slot ${runtime.slot} · ${appName} → ${app.url}`);
/* oxlint-enable eslint/no-console */

/* oxlint-disable typescript/explicit-function-return-type -- child: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable node/no-process-env -- child: This process boundary owns environment loading/forwarding; consumers receive the resulting validated configuration. */
/* oxlint-disable eslint/no-magic-numbers -- child: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
const child = (() => {
  try {
    return spawn(args, {
      env: {
        ...process.env,
        ...app.env,
      },
      stderr: "inherit",
      stdin: "inherit",
      stdout: "inherit",
    });
  } catch (error) {
    return fail(
      `Failed to start "${args[0]}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
})();
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-process-env */
/* oxlint-enable typescript/explicit-function-return-type */

process.on("SIGTERM", () => child.kill("SIGTERM"));

process.exit(await child.exited);
