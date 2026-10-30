import { Command } from "commander";
import path from "node:path";
import { handleError } from "#cli/utils/handle-error";
import {
  formatInstallationStatus,
  installationStatus,
} from "#cli/utils/installation-status";

export const status = new Command("status")
  .description(
    "inspect plugin ownership, local edits, and removal dependencies without writing"
  )
  .option("-c, --cwd <cwd>", "project directory", process.cwd())
  .option("--files", "list every plugin-owned file", false)
  .option("--json", "print the full inventory as JSON", false)
  .action(
    async (
      options: Readonly<{ cwd: string; files: boolean; json: boolean }>
    ) => {
      try {
        const report = await installationStatus(path.resolve(options.cwd));
        process.stdout.write(
          options.json
            ? `${JSON.stringify(report, null, 2)}\n`
            : formatInstallationStatus(report, options.files)
        );
      } catch (error) {
        handleError(error);
      }
    }
  );
