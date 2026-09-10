import type { ModelMessage, ToolSet } from "ai";
import type { ToolContext } from "eve/tools";
import { codeExecution } from "../../tools/platform/code-execution";
import { generateVideoTool } from "../../tools/platform/generate-video";
import type { ResearchUpdate } from "../../tools/platform/research-updates-schema";
import { tavilyWebSearch } from "../../tools/platform/web-search";
import type { StreamWriter } from "../ai/types";
import { config } from "../config";
import { executeEveTool } from "./adapt-tool";
import { createEvePlatformResult } from "./platform-result";

export function getEvePlatformTools({
  dataStream,
  costAccumulator,
  selectedModel,
}: {
  dataStream: Pick<StreamWriter, "write">;
  costAccumulator?: { addAPICost(name: string, cost: number): void };
  selectedModel?: string;
}): ToolSet {
  return {
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
        let costCents = 0;
        const updates = new Map<string, ResearchUpdate>();
        const enqueue = (output: unknown) => {
          if (!cancelled) {
            controller.enqueue(
              createEvePlatformResult(output, costCents / 100, [
                ...updates.values(),
              ])
            );
          }
        };
        try {
          abortSignal.throwIfAborted();
          const tools = getEvePlatformTools({
            selectedModel,
            costAccumulator: {
              addAPICost(_name, cost) {
                if (!Number.isFinite(cost) || cost < 0) {
                  throw new Error("Invalid platform tool cost.");
                }
                costCents += cost;
              },
            },
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
            enqueue(output);
          }
          if (!cancelled) {
            controller.close();
          }
        } catch (error) {
          if (!cancelled) {
            if (costCents > 0) {
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
