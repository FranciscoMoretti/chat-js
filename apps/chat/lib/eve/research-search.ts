import { jsonSchema, tool } from "ai";
import type { ToolContext, ToolModelOutput } from "eve/tools";
import { z } from "zod";

import { ResearchUpdateSchema } from "../../tools/platform/research-updates-schema";
import type { ToolProgressWriter } from "../ai/tool-context";
import {
  getInstalledTool,
  installedToolSchema,
  invokeInstalledTool,
} from "./invoke-installed-tool";
import { toolResultToModelOutput } from "./tool-model-output";
import { toolResultSchema } from "./tool-result";
import type { ToolOutput } from "./tool-result";
import type { ToolUsage } from "./tool-usage";

/** The research SDK loop consumes the same native implementation and accounts its final receipt once. */
export const createResearchSearchTool = (
  context: ToolContext,
  usage: ToolUsage,
  dataStream: ToolProgressWriter
) => {
  const native = getInstalledTool("webSearch");
  if (!native) {
    return;
  }
  return tool<unknown, ToolOutput, Record<string, never>>({
    description: native.description,
    execute: async (input, options): Promise<ToolOutput> => {
      let final: ToolOutput = null;
      for await (const output of invokeInstalledTool("webSearch", input, {
        ...context,
        abortSignal: options.abortSignal
          ? AbortSignal.any([context.abortSignal, options.abortSignal])
          : context.abortSignal,
      })) {
        final = output;
        const receipt = toolResultSchema.safeParse(output);
        if (!receipt.success) {
          continue;
        }
        // Entries can replace earlier running statuses in place. Replay the
        // cumulative snapshot with stable IDs so consumers receive those changes.
        for (const [index, update] of (receipt.data.updates ?? []).entries()) {
          const parsed = ResearchUpdateSchema.safeParse(update);
          if (
            parsed.success &&
            parsed.data.type !== "started" &&
            parsed.data.type !== "completed"
          ) {
            dataStream.write({
              data: { ...parsed.data, toolCallId: context.callId },
              id: `${options.toolCallId}:${index}`,
              type: "data-researchUpdate",
            });
          }
        }
      }
      const receipt = toolResultSchema.safeParse(final);
      if (!receipt.success) {
        usage.markUnknown();
        return final;
      }
      if (receipt.data.usage.costUsd === undefined) {
        usage.markUnknown();
      } else {
        usage.addCostUsd(receipt.data.usage.costUsd);
      }
      return final;
    },
    inputSchema: jsonSchema(installedToolSchema(native)),
    toModelOutput: async ({ output }: { output: ToolOutput }) => {
      const receipt = toolResultSchema.safeParse(output);
      let projected: ToolModelOutput;
      if (native.toModelOutput) {
        projected = await native.toModelOutput(output);
      } else if (receipt.success) {
        projected = toolResultToModelOutput(receipt.data);
      } else {
        projected = { type: "json", value: output };
      }
      if (projected.type === "json") {
        return {
          type: "json",
          // oxlint-disable-next-line unicorn/prefer-structured-clone -- JSON serialization removes optional undefined fields at the model wire boundary.
          value: z.json().parse(JSON.parse(JSON.stringify(projected.value))),
        };
      }
      if (projected.type === "content") {
        return { type: "content", value: [...projected.value] };
      }
      return projected;
    },
  });
};
