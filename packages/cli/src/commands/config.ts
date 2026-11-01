import { Command } from "commander";
import type { PackageManager } from "#cli/types";
import { handleError } from "#cli/utils/handle-error";
import { inferPackageManager } from "#cli/utils/get-package-manager";
import { once } from "node:events";
import path from "node:path";
import { spawn } from "node:child_process";

const EXIT_SUCCESS = 0;

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
    case "npm": {
      return ["npx", ["tsx", "--eval", EVAL_SCRIPT]];
    }
    // No default
  }
  return ["npx", ["tsx", "--eval", EVAL_SCRIPT]];
};

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
      child.stderr.on("data", (data): void => {
        stderr.push(String(data));
      });

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
      if (code !== EXIT_SUCCESS) {
        throw new Error(`Failed to resolve config:\n${stderr.join("").trim()}`);
      }
    } catch (error) {
      handleError(error);
    }
  });
