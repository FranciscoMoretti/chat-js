import path from "node:path";

import { Command } from "commander";

import { handleError } from "../utils/handle-error";
import { syncFeatures } from "../utils/sync-features";
import { syncTools } from "../utils/sync-tools";

export const sync = new Command("sync")
  .description("regenerate typed tool, feature, and router registrations")
  .option("-c, --cwd <cwd>", "project directory", process.cwd())
  .action(async (options) => {
    try {
      await syncTools(path.resolve(options.cwd));
      await syncFeatures(path.resolve(options.cwd));
    } catch (error) {
      handleError(error);
    }
  });
