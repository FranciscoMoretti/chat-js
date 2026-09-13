import { randomUUID } from "node:crypto";

import { type ModelMessage, wrapLanguageModel } from "ai";
import type { ToolContext } from "eve/tools";
import { z } from "zod";

import { getDeepResearchConfig } from "../../tools/platform/deep-research/configuration";
import { runDeepResearchPipeline } from "../../tools/platform/deep-research/pipeline";
import { config } from "../config";
import { eveDocumentResult } from "./document-contracts";
import { executeEveDocumentTool } from "./document-tools";
import { loadEveModelDefinition, resolveEveModel } from "./model-selection";
import { executeEvePlatformOperation } from "./platform-operation";

export const eveResearchInput = z.object({});

export async function* executeEveResearch(
  input: unknown,
  context: Pick<ToolContext, "session" | "callId" | "abortSignal">,
  messages: ModelMessage[]
) {
  eveResearchInput.parse(input);
  if (
    !(
      config.ai.tools.deepResearch.enabled &&
      config.ai.tools.documents.enabled &&
      config.ai.tools.documents.types.text
    )
  ) {
    throw new Error("Deep research requires enabled text documents.");
  }
  yield* executeEvePlatformOperation(
    context.abortSignal,
    async function* (options) {
      const result = await runDeepResearchPipeline(
        {
          messages,
          requestId: randomUUID(),
          messageId: context.callId,
          toolCallId: context.callId,
        },
        getDeepResearchConfig(),
        options.dataStream,
        {
          ...options,
          getLanguageModel: async (id) => {
            const resolved = await resolveEveModel(id);
            return wrapLanguageModel({
              model: resolved.model,
              middleware: {
                specificationVersion: "v4",
                transformParams: async ({ params }) => ({
                  ...params,
                  providerOptions: {
                    ...resolved.modelOptions.providerOptions,
                    ...params.providerOptions,
                  },
                }),
              },
            });
          },
          getModelContextWindow: async (id) =>
            (await loadEveModelDefinition(id)).context_window,
          saveReport: async (content) => {
            options.abortSignal.throwIfAborted();
            const document = eveDocumentResult.parse(
              await executeEveDocumentTool("createTextDocument", content, {
                ...context,
                abortSignal: options.abortSignal,
              })
            );
            return { ...document, result: "Research report saved." };
          },
        }
      );
      yield result.type === "report"
        ? { ...result.data, format: "report" }
        : { answer: result.data, format: "clarifying_questions" };
    }
  );
}
