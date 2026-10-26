import { assertUiCompatibility } from "#cli/utils/ui-compatibility";
import { readInstalledPlugins } from "#cli/utils/installed-plugins";
import { Command } from "commander";
import { handleError } from "#cli/utils/handle-error";
import path from "node:path";
import { syncPlugins } from "#cli/utils/sync-plugins";
import { readInstalledTools, syncTools } from "#cli/utils/sync-tools";

export const sync = new Command("sync")
  .description("regenerate typed tool, plugin, and router registrations")
  .option("-c, --cwd <cwd>", "project directory", process.cwd())
  .action(async (options: { readonly cwd: string }) => {
    try {
      await assertUiCompatibility(path.resolve(options.cwd), [
        ...(await readInstalledPlugins(path.resolve(options.cwd))),
        ...(await readInstalledTools(path.resolve(options.cwd))),
      ]);
      await syncTools(path.resolve(options.cwd));
      await syncPlugins(path.resolve(options.cwd));
    } catch (error) {
      handleError(error);
    }
  });
