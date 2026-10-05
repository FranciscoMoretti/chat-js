// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI launches package-manager, Git, or command subprocesses through native process APIs.
import { spawn } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI observes native process or stream lifecycle events.
import { once } from "node:events";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";

import { Command } from "commander";

import type { PackageManager } from "#cli/types";
import { inferPackageManager } from "#cli/utils/get-package-manager";
import { handleError } from "#cli/utils/handle-error";

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

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
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
      child.stderr?.on("data", (data): void => {
        stderr.push(String(data));
      });

      let code: number | null;
      try {
        // oxlint-disable-next-line typescript/no-unsafe-assignment -- Node child-process close emits the exit code followed by a signal; the event library exposes an untyped tuple.
        [code] = await once(child, "close");
      } catch (error) {
        throw new Error(
          `Could not spawn ${cmd}. Make sure ${pm} is installed. ${error instanceof Error ? error.message : String(error)}`,
          {
            cause: error,
          }
        );
      }

      if (code !== 0) {
        throw new Error(`Failed to resolve config:\n${stderr.join("").trim()}`);
      }
    } catch (error) {
      handleError(error);
    }
  });
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/max-statements */
