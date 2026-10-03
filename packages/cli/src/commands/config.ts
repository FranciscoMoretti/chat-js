/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { spawn } from "node:child_process";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { once } from "node:events";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { Command } from "commander";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { PackageManager } from "../types";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { inferPackageManager } from "../utils/get-package-manager";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { handleError } from "../utils/handle-error";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */

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

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
  .action(async (opts: { cwd: string }) => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/prefer-default-export */
