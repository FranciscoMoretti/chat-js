// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Command } from "commander";
/* oxlint-enable sort-imports */

import { handleError } from "#cli/utils/handle-error";
import { syncFeatures } from "#cli/utils/sync-features";
import { syncTools } from "#cli/utils/sync-tools";

export const sync = new Command("sync")
  .description("regenerate typed tool, feature, and router registrations")
  .option("-c, --cwd <cwd>", "project directory", process.cwd())
  .action(async (options: { readonly cwd: string }) => {
    try {
      await syncTools(path.resolve(options.cwd));
      await syncFeatures(path.resolve(options.cwd));
    } catch (error) {
      handleError(error);
    }
  });
