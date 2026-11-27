import {
  projectDirectory,
  dryRun,
  skipConfirmation,
} from "#cli/helpers/project-options";
import { formatActivation } from "#cli/utils/installation-activation";
import { confirm, isCancel, log } from "@clack/prompts";
import {
  canPickItems,
  promptRemoveSelection,
} from "#cli/helpers/project-selection";
import { selectionCommand } from "#cli/helpers/selection-options";
import path from "node:path";
import { handleError } from "#cli/utils/handle-error";
import { removePlugins } from "#cli/utils/remove-plugins";

export const remove = selectionCommand("remove")
  .description(
    "remove installed plugins, retaining database schemas and user data"
  )
  .argument("[plugins...]", "installed plugin IDs")
  .addOption(projectDirectory())
  .addOption(dryRun())
  .option(
    "--backup",
    "preserve removed source, including customizations, under chatjs/removed-plugins",
    false
  )
  .addOption(skipConfirmation())
  .action(
    async (
      input: readonly string[],
      options: Readonly<{
        cwd: string;
        dryRun: boolean;
        backup: boolean;
        plugin?: readonly string[];
        yes: boolean;
      }>
    ) => {
      try {
        const cwd = path.resolve(options.cwd);
        let ids: readonly string[] = [
          ...new Set([...input, ...(options.plugin ?? [])]),
        ];
        if (!ids.length && canPickItems(options.yes)) {
          const picked = await promptRemoveSelection(cwd);
          if (picked === undefined || picked.length === 0) {
            return;
          }
          ids = picked;
        }
        const plan = await removePlugins(cwd, ids, { dryRun: true });
        for (const item of plan.activation) {
          log.info(
            `${item.id} activation being removed:\n${formatActivation(item)}`
          );
        }
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
