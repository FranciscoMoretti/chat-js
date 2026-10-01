import { access } from "node:fs/promises";
import path from "node:path";

import { confirm, isCancel, log } from "@clack/prompts";
import { Command } from "commander";

import { installItems } from "../registry/shadcn";
import { handleError } from "../utils/handle-error";
import { planInstallation } from "../utils/installation-plan";
import {
  assertSupportedFeatureInstallation,
  syncFeatures,
} from "../utils/sync-features";
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
      const plan = await planInstallation(cwd, { features: [], tools });
      assertSupportedFeatureInstallation(plan.features);
      if (!options.yes) {
        const answer = await confirm({
          message: `Install ${tools.join(", ")}?`,
        });
        if (isCancel(answer) || !answer) {
          return;
        }
      }
      const mcp = plan.features.some((feature) => feature.id === "mcp");
      const uploads = plan.features.some(
        (feature) => feature.id === "attachment-uploads"
      );
      await installItems(plan.sources, cwd, options.overwrite);
      try {
        await syncTools(cwd, { expected: plan.expected });
        await syncFeatures(cwd, {
          addUi: mcp || uploads,
          expectedMcp: mcp,
          expectedUploads: uploads,
        });
        if (mcp) {
          log.info(
            "MCP installed. Set MCP_ENCRYPTION_KEY before connecting servers."
          );
        }
      } catch (error) {
        throw new Error(
          `Source installation completed, but registration failed. Fix the problem and run ${mcp ? "chat-js add mcp to retry UI integration (or integrate the UI manually and run chat-js sync)" : "chat-js sync"}. ${error instanceof Error ? error.message : error}`,
          { cause: error }
        );
      }
    } catch (error) {
      handleError(error);
    }
  });
