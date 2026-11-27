import { projectDirectory, jsonOutput } from "#cli/helpers/project-options";
import { Command } from "commander";
import path from "node:path";
import { handleError } from "#cli/utils/handle-error";
import { loadSourceFormatter } from "#cli/utils/source-formatter";
import {
  formatInstallationStatus,
  installationStatus,
} from "#cli/utils/installation-status";

export const status = new Command("status")
  .description(
    "inspect installation file kinds, local edits, and plugin removal dependencies without writing"
  )
  .addOption(projectDirectory())
  .option("--files", "list every plugin-owned file", false)
  .addOption(jsonOutput())
  .option(
    "--format-source <module>",
    "project module exporting formatSource for comparison"
  )
  .action(
    async (
      options: Readonly<{
        cwd: string;
        files: boolean;
        json: boolean;
        formatSource?: string;
      }>
    ) => {
      try {
        const cwd = path.resolve(options.cwd);
        const formatSource =
          options.formatSource === undefined
            ? undefined
            : await loadSourceFormatter(cwd, options.formatSource);
        const report = await installationStatus(cwd, { formatSource });
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
