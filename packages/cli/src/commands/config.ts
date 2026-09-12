import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";

import { Command } from "commander";

import type { PackageManager } from "../types";
import { inferPackageManager } from "../utils/get-package-manager";
import { handleError } from "../utils/handle-error";

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
  .action(async (opts) => {
    try {
      const cwd = path.resolve(opts.cwd);

      const pm = inferPackageManager(cwd);
      const [cmd, args] = getTsEvalCommand(pm);

      const child = spawn(cmd, args, {
        cwd,
        stdio: ["ignore", "inherit", "pipe"],
      });

      const stderr: string[] = [];
      child.stderr?.on("data", (data) => stderr.push(String(data)));

      let code: number | null;
      try {
        [code] = await once(child, "close");
      } catch (error) {
        throw new Error(
          `Could not spawn ${cmd}. Make sure ${pm} is installed.`,
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
