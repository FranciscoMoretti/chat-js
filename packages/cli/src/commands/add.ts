import { access } from "node:fs/promises";
import path from "node:path";

import { confirm, isCancel, log } from "@clack/prompts";
import { Command } from "commander";

import { installItems } from "../registry/shadcn";
import { handleError } from "../utils/handle-error";
import { planToolInstallation } from "../utils/installation-plan";
import { syncFeatures } from "../utils/sync-features";
import { syncTools } from "../utils/sync-tools";

export const add = new Command("add")
  .description(
    "install registry tools or MCP and update their ChatJS registrations"
  )
  .argument(
    "<tools...>",
    "tool names, mcp, or standard shadcn registry addresses"
  )
  .option("-y, --yes", "skip confirmation", false)
  .option("-o, --overwrite", "overwrite existing installed source files", false)
  .option("-c, --cwd <cwd>", "project directory", process.cwd())
  .action(async (tools: string[], options) => {
    try {
      const cwd = path.resolve(options.cwd);
      await access(path.join(cwd, "chat.config.ts"));
      const plan = await planToolInstallation(cwd, tools);
      if (!options.yes) {
        const answer = await confirm({
          message: `Install ${tools.join(", ")}?`,
        });
        if (isCancel(answer) || !answer) {
          return;
        }
      }
      await installItems(plan.sources, cwd, options.overwrite);
      try {
        await syncTools(cwd, { expected: plan.expected });
        await syncFeatures(cwd, { addUi: plan.mcp, expectedMcp: plan.mcp });
        if (plan.mcp) {
          log.info(
            "MCP installed. Enable ai.tools.mcp.enabled in chat.config.ts and set MCP_ENCRYPTION_KEY before connecting servers."
          );
        }
      } catch (error) {
        throw new Error(
          `Source installation completed, but registration failed. Fix the problem and run ${plan.mcp ? "chat-js add mcp to retry UI integration (or integrate the UI manually and run chat-js sync)" : "chat-js sync"}. ${error instanceof Error ? error.message : error}`,
          { cause: error }
        );
      }
    } catch (error) {
      handleError(error);
    }
  });
