import type { ResearchUpdate } from "../../tools/platform/research-updates-schema";
import type { StreamWriter } from "../ai/types";
import { createEvePlatformResult } from "./platform-result";
import { createEveToolCost } from "./tool-cost";

/**
 * Share cancellation, progress and durable usage handling across native tools.
 * @yields {object} Durable tool output and usage updates.
 */
export const executeEvePlatformOperation =
  async function* executeEvePlatformOperation(
    signal: AbortSignal,
    execute: (options: {
      abortSignal: AbortSignal;
      dataStream: Pick<StreamWriter, "write">;
      costAccumulator: ReturnType<typeof createEveToolCost>;
    }) => AsyncIterable<unknown>
  ) {
    let cancelled = false;
    const cancellation = new AbortController();
    const abortSignal = AbortSignal.any([signal, cancellation.signal]);
    const stream = new ReadableStream<
      ReturnType<typeof createEvePlatformResult>
    >({
      cancel() {
        cancelled = true;
        cancellation.abort();
      },
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
          for await (const output of execute({
            abortSignal,
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
          })) {
            try {
              costUsd = await costs.totalUsd();
            } catch {
              costUsd = undefined;
            }
            enqueue(output);
          }
          if (!cancelled) {
            controller.close();
          }
        } catch (error) {
          if (!cancelled) {
            try {
              costUsd = await costs.totalUsd();
            } catch {
              costUsd = undefined;
            }
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
    });
    yield* stream;
  };
