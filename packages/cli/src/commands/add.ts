import { access } from "node:fs/promises";
import path from "node:path";

import { confirm, isCancel } from "@clack/prompts";
import { Command } from "commander";

import { toolDefinitionSchema } from "../../../registry/metadata";
import { installItems, itemAddress, readItem } from "../registry/shadcn";
import { handleError } from "../utils/handle-error";
import { syncTools } from "../utils/sync-tools";

export const add = new Command("add")
  .description(
    "install registry tools and regenerate their ChatJS registrations"
  )
  .argument("<tools...>", "tool names or standard shadcn registry addresses")
  .option("-y, --yes", "skip confirmation", false)
  .option("-o, --overwrite", "overwrite existing installed source files", false)
  .option("-c, --cwd <cwd>", "project directory", process.cwd())
  .action(async (tools: string[], options) => {
    try {
      const cwd = path.resolve(options.cwd);
      await access(path.join(cwd, "chat.config.ts"));
      const addresses = tools.map((tool) => itemAddress(tool, "tool"));
      const expected = await Promise.all(
        addresses.map(async (address) => {
          const item = await readItem(address, cwd);
          return toolDefinitionSchema.parse(item.meta?.chatjs);
        })
      );
      if (!options.yes) {
        const answer = await confirm({
          message: `Install ${tools.join(", ")}?`,
        });
        if (isCancel(answer) || !answer) {
          return;
        }
      }
      await syncTools(cwd, { checkOnly: true });
      await installItems(addresses, cwd, options.overwrite);
      try {
        await syncTools(cwd, { expected });
      } catch (error) {
        throw new Error(
          `Source installation completed, but registration failed. Fix the problem and run chat-js sync. ${error instanceof Error ? error.message : error}`,
          { cause: error }
        );
      }
    } catch (error) {
      handleError(error);
    }
  });
