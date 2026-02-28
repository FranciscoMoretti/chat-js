import { Command } from "commander";
import { spawn } from "node:child_process";
import path from "node:path";
import { handleError } from "../utils/handle-error";
import { inferPackageManager } from "../utils/get-package-manager";
import type { PackageManager } from "../types";

const EVAL_SCRIPT = `
import userConfig from "./chat.config.ts";
import { applyDefaults } from "./lib/config-schema";
console.log(JSON.stringify(applyDefaults(userConfig), null, 2));
`;

function getTsEvalCommand(pm: PackageManager): [string, string[]] {
  switch (pm) {
    case "bun":
      return ["bun", ["--eval", EVAL_SCRIPT]];
    case "pnpm":
      return ["pnpm", ["dlx", "tsx", "--eval", EVAL_SCRIPT]];
    case "yarn":
      return ["yarn", ["dlx", "tsx", "--eval", EVAL_SCRIPT]];
    default:
      return ["npx", ["tsx", "--eval", EVAL_SCRIPT]];
  }
}

export const config = new Command()
  .name("config")
  .description("print the resolved configuration for the current ChatJS project")
  .option(
    "-c, --cwd <cwd>",
    "the working directory (defaults to current directory)",
    process.cwd(),
  )
  .action(async (opts) => {
    try {
      const cwd = path.resolve(opts.cwd);

      const pm = inferPackageManager();
      const [cmd, args] = getTsEvalCommand(pm);

      await new Promise<void>((resolve, reject) => {
        const child = spawn(cmd, args, {
          cwd,
          stdio: ["ignore", "inherit", "pipe"],
        });

        const stderr: string[] = [];
        child.stderr?.on("data", (data) => stderr.push(String(data)));

        child.on("error", (err) => {
          reject(
            new Error(
              `Could not spawn ${cmd}. Make sure ${pm} is installed.\n${err.message}`,
            ),
          );
        });

        child.on("close", (code) => {
          if (code === 0) resolve();
          else
            reject(
              new Error(
                `Failed to resolve config:\n${stderr.join("").trim()}`,
              ),
            );
        });
      });
    } catch (error) {
      handleError(error);
    }
  });
