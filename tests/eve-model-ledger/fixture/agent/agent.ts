import { defineAgent, defineDynamic } from "eve";
import type { DynamicResolveContext } from "eve";
import { z } from "zod";
import { appendFile, readFile } from "node:fs/promises";
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
} from "@ai-sdk/provider";
import { wrapEveModel } from "../model-ledger";

const write = async (value: unknown): Promise<void> => {
  await appendFile("ledger.jsonl", `${JSON.stringify(value)}\n`);
};
const model = (blank: boolean): LanguageModelV4 => {
  const generate = async (options: LanguageModelV4CallOptions) => {
    const compact = options.prompt.some(
      (message) =>
        message.role === "system" &&
        typeof message.content === "string" &&
        message.content.includes("CONTEXT CHECKPOINT COMPACTION")
    );
    const summary = blank ? "" : "Checkpoint summary.";
    const text = compact ? summary : "Ordinary answer.";
    await write({ kind: "provider", compact });
    return {
      content: [{ type: "text" as const, text }],
      finishReason: { unified: "stop" as const, raw: "stop" },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      providerMetadata: { gateway: { cost: compact ? "0.02" : "0.01" } },
      warnings: [],
    };
  };
  return {
    specificationVersion: "v4",
    provider: "proof",
    modelId: "wrapped",
    supportedUrls: {},
    doGenerate: generate,
    async doStream(options) {
      const result = await generate(options);
      const text = result.content[0]?.text ?? "";
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            controller.enqueue({ type: "text-start", id: "text" });
            controller.enqueue({ type: "text-delta", id: "text", delta: text });
            controller.enqueue({ type: "text-end", id: "text" });
            controller.enqueue({
              type: "finish",
              usage: result.usage,
              finishReason: result.finishReason,
              providerMetadata: result.providerMetadata,
            });
            controller.close();
          },
        }),
      };
    },
  };
};
export default defineAgent({
  defaultTools: false,
  model: defineDynamic({
    events: {
      "step.started": (event: unknown, ctx: DynamicResolveContext) => {
        const parsed = z
          .object({ data: z.object({ turnId: z.string() }) })
          .parse(event);
        const messages = JSON.stringify(ctx.messages);
        const scope = {
          ownerId: ctx.session.auth.initiator?.principalId ?? "missing-owner",
          sessionId: ctx.session.id,
          turnId: parsed.data.turnId,
        };
        return {
          modelContextWindowTokens: messages.includes("case:auto")
            ? 4000
            : 128_000,
          model: wrapEveModel(model(messages.includes("case:blank")), scope, {
            async begin(attempt) {
              await write({ ...attempt, kind: "intent" });
            },
            async finish(attempt, receipt) {
              const contents = await readFile("ledger.jsonl", "utf-8");
              const rows = contents.trim().split("\n");
              if (!rows.some((row) => row.includes(attempt.eventId))) {
                throw new Error("Receipt without intent");
              }
              await write({ ...attempt, ...receipt, kind: "receipt" });
            },
          }),
        };
      },
    },
  }),
});
