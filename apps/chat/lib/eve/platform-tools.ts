import type { ModelMessage, ToolSet } from "ai";
import type { ToolContext } from "eve/tools";
import { codeExecution } from "../../tools/platform/code-execution";
import { generateImageTool } from "../../tools/platform/generate-image";
import { generateVideoTool } from "../../tools/platform/generate-video";
import type { ResearchUpdate } from "../../tools/platform/research-updates-schema";
import { tavilyWebSearch } from "../../tools/platform/web-search";
import type { StreamWriter } from "../ai/types";
import { config } from "../config";
import { executeEveTool } from "./adapt-tool";
import { eveImageContext } from "./image-context";
import { createEvePlatformResult } from "./platform-result";
import { createEveToolCost } from "./tool-cost";

export function getEvePlatformTools({
  dataStream,
  costAccumulator,
  selectedModel,
  messages = [],
}: {
  dataStream: Pick<StreamWriter, "write">;
  costAccumulator?: Pick<
    ReturnType<typeof createEveToolCost>,
    "addAPICost" | "addLLMCost"
  >;
  selectedModel?: string;
  messages?: readonly ModelMessage[];
}): ToolSet {
  return {
    ...(config.ai.tools.image.enabled
      ? {
          generateImage: generateImageTool({
            ...eveImageContext(messages),
            selectedModel,
            costAccumulator,
          }),
        }
      : {}),
    ...(config.ai.tools.video.enabled
      ? { generateVideo: generateVideoTool({ costAccumulator, selectedModel }) }
      : {}),
    ...(config.ai.tools.codeExecution.enabled
      ? { codeExecution: codeExecution({ costAccumulator }) }
      : {}),
    ...(config.ai.tools.webSearch.enabled
      ? {
          webSearch: tavilyWebSearch({
            dataStream,
            costAccumulator,
            writeTopLevelUpdates: true,
          }),
        }
      : {}),
  };
}

/** Persist progress with the native tool call, avoiding a second transcript store. */
export async function* executeEvePlatformTool(
  name: string,
  input: unknown,
  context: Pick<ToolContext, "callId" | "abortSignal">,
  messages: readonly ModelMessage[],
  selectedModel?: string
) {
  let cancelled = false;
  const cancellation = new AbortController();
  const abortSignal = AbortSignal.any([
    context.abortSignal,
    cancellation.signal,
  ]);
  const stream = new ReadableStream<ReturnType<typeof createEvePlatformResult>>(
    {
      async start(controller) {
        const costs = createEveToolCost();
        let costUsd: number | undefined = 0;
        const updates = new Map<string, ResearchUpdate>();
        const enqueue = (output: unknown) => {
          if (!cancelled) {
            controller.enqueue(
              createEvePlatformResult(output, costUsd, [...updates.values()])
            );
          }
        };
        try {
          abortSignal.throwIfAborted();
          const tools = getEvePlatformTools({
            selectedModel,
            messages,
            costAccumulator: costs,
            dataStream: {
              write(part) {
                if (part.type !== "data-researchUpdate") {
                  throw new Error("Unsupported platform progress update.");
                }
                updates.set(part.id ?? `update-${updates.size}`, part.data);
                enqueue({ searches: [] });
              },
            },
          });
          if (!Object.hasOwn(tools, name)) {
            throw new Error(`Platform tool is unavailable: ${name}`);
          }
          for await (const output of executeEveTool(
            tools[name],
            input,
            { ...context, abortSignal },
            messages
          )) {
            costUsd = await costs.totalUsd().catch(() => undefined);
            enqueue(output);
          }
          if (!cancelled) {
            controller.close();
          }
        } catch (error) {
          if (!cancelled) {
            costUsd = await costs.totalUsd().catch(() => undefined);
            if (costUsd === undefined || costUsd > 0) {
              // Provider work may already be charged when result processing fails.
              enqueue({
                error:
                  "The tool failed after provider work completed. Please try again.",
              });
              controller.close();
            } else {
              controller.error(error);
            }
          }
        }
      },
      cancel() {
        cancelled = true;
        cancellation.abort();
      },
    }
  );
  yield* stream;
}
