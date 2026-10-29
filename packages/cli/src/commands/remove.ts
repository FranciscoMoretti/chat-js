import { confirm, isCancel, log } from "@clack/prompts";
import { Command } from "commander";
import path from "node:path";
import { handleError } from "#cli/utils/handle-error";
import { removePlugins } from "#cli/utils/remove-plugins";

export const remove = new Command("remove")
  .description(
    "remove installed plugins, retaining database schemas and user data"
  )
  .argument("<plugins...>", "installed plugin IDs")
  .option("-c, --cwd <cwd>", "project directory", process.cwd())
  .option("--dry-run", "show removal and retained files without writing", false)
  .option(
    "--backup",
    "preserve removed source, including customizations, under .chatjs",
    false
  )
  .option(
    "-y, --yes",
    "skip confirmation; does not authorize removing modified source",
    false
  )
  .action(
    async (
      ids: readonly string[],
      options: Readonly<{
        cwd: string;
        dryRun: boolean;
        backup: boolean;
        yes: boolean;
      }>
    ) => {
      try {
        const cwd = path.resolve(options.cwd);
        const plan = await removePlugins(cwd, ids, { dryRun: true });
        log.info(`Remove:\n${plan.files.join("\n")}`);
        if (plan.preserved.length) {
          log.info(`Retain schema sources:\n${plan.preserved.join("\n")}`);
        }
        if (plan.modified.length) {
          log.warn(`Modified or untracked:\n${plan.modified.join("\n")}`);
        }
        if (options.dryRun) {
          return;
        }
        if (!options.yes) {
          const answer = await confirm({
            message: `Remove ${ids.join(", ")}? Database data, schema inputs, shared UI and package dependencies are retained.`,
          });
          if (isCancel(answer) || !answer) {
            return;
          }
        }
        const result = await removePlugins(cwd, ids, {
          backup: options.backup,
        });
        log.success(
          `Removed plugin registrations and owned source.${result.backup === undefined ? "" : ` Source backup: ${result.backup}`} No database changes were applied.`
        );
      } catch (error) {
        handleError(error);
      }
    }
  );
