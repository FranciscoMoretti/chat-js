/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

import { Command } from "commander";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { handleError } from "../utils/handle-error";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { syncFeatures } from "../utils/sync-features";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { syncTools } from "../utils/sync-tools";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const sync = new Command("sync")
  .description("regenerate typed tool, feature, and router registrations")
  .option("-c, --cwd <cwd>", "project directory", process.cwd())
  .action(async (options: { cwd: string }) => {
    try {
      await syncTools(path.resolve(options.cwd));
      await syncFeatures(path.resolve(options.cwd));
    } catch (error) {
      handleError(error);
    }
  });
/* oxlint-enable typescript/prefer-readonly-parameter-types */
