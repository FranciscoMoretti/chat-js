import { projectDirectory, jsonOutput } from "#cli/helpers/project-options";
import { Command } from "commander";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { handleError } from "#cli/utils/handle-error";

export const setup = new Command("setup")
  .description(
    "check application configuration; use eve add for native integration setup"
  )
  .addOption(projectDirectory())
  .addOption(jsonOutput())
  .action(
    async (
      options: Readonly<{
        cwd: string;
        json: boolean;
      }>
    ) => {
      try {
        const cwd = path.resolve(options.cwd);
        const script = path.join(cwd, "scripts/agent-status.ts");
        await access(script);
        const { promise, resolve, reject } = Promise.withResolvers<number>();
        const child = spawn(
          "bun",
          [script, ...(options.json ? ["--json"] : [])],
          { cwd, stdio: "inherit" }
        );
        child.on("error", reject);
        child.on("close", (status) => {
          resolve(status ?? 1);
        });
        process.exitCode = await promise;
      } catch (error) {
        handleError(error);
      }
    }
  );
