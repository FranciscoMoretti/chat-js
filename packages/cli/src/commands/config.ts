// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI launches package-manager, Git, or command subprocesses through native process APIs.
import { spawn } from "node:child_process";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI observes native process or stream lifecycle events.
import { once } from "node:events";
/* oxlint-enable sort-imports */
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Command } from "commander";
/* oxlint-enable sort-imports */

import type { PackageManager } from "#cli/types";
import { inferPackageManager } from "#cli/utils/get-package-manager";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { handleError } from "#cli/utils/handle-error";
/* oxlint-enable sort-imports */

const EVAL_SCRIPT = `
import userConfig from "./chat.config.ts";
import { applyDefaults } from "./lib/config-schema";
console.log(JSON.stringify(applyDefaults(userConfig), null, 2));
`;

const getTsEvalCommand = (pm: PackageManager): [string, string[]] => {
  switch (pm) {
    case "bun": {
      return ["bun", ["--eval", EVAL_SCRIPT]];
    }
    case "pnpm": {
      return ["pnpm", ["dlx", "tsx", "--eval", EVAL_SCRIPT]];
    }
    case "yarn": {
      return ["yarn", ["dlx", "tsx", "--eval", EVAL_SCRIPT]];
    }
    default: {
      return ["npx", ["tsx", "--eval", EVAL_SCRIPT]];
    }
  }
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (config); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve config's awaited sequencing and rejected-Promise behavior. */
export const config = new Command()
  .name("config")
  .description(
    "print the resolved configuration for the current ChatJS project"
  )
  .option(
    "-c, --cwd <cwd>",
    "the working directory (defaults to current directory)",
    process.cwd()
  )
  // oxlint-disable-next-line max-statements -- Configuration evaluation must spawn, collect stderr, await close, and translate startup versus command failures in order.
  .action(async (opts: { readonly cwd: string }) => {
    try {
      const cwd = path.resolve(opts.cwd);

      const pm = inferPackageManager(cwd);
      const [cmd, args] = getTsEvalCommand(pm);

      const child = spawn(cmd, args, {
        cwd,
        stdio: ["ignore", "inherit", "pipe"],
      });

      const stderr: string[] = [];
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading on from child.stderr; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      child.stderr?.on("data", (data): void => {
        stderr.push(String(data));
      });

      // oxlint-disable-next-line init-declarations -- The close event is assigned only after awaiting the child; startup failures throw before any exit status is inspected.
      let closeEvent: readonly unknown[];
      try {
        closeEvent = await once(child, "close");
      } catch (error) {
        throw new Error(
          `Could not spawn ${cmd}. Make sure ${pm} is installed. ${error instanceof Error ? error.message : String(error)}`,
          {
            cause: error,
          }
        );
      }

      const [code] = closeEvent;
      // oxlint-disable-next-line no-magic-numbers -- Native subprocess exit status zero denotes successful configuration evaluation.
      if (code !== 0) {
        throw new Error(`Failed to resolve config:\n${stderr.join("").trim()}`);
      }
    } catch (error) {
      handleError(error);
    }
  });
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
