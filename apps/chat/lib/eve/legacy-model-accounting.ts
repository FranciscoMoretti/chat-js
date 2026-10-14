import { z } from "zod";
import { hasEveToolReceipt, toolResultSchema } from "./tool-result";

const cost = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
const envelope = z.object({
  type: z.string(),
  meta: z.object({ id: z.string().min(1) }),
  data: z.unknown(),
});
const modelUsage = z.object({
  turnId: z.string(),
  usage: z.object({ costUsd: z.unknown().optional() }).optional(),
  providerMetadata: z
    .object({
      gateway: z.object({ generationId: z.string().optional() }).optional(),
    })
    .optional(),
});
const hookUsage = z.object({
  turnId: z.string(),
  modelCalls: z
    .array(
      modelUsage
        .omit({ turnId: true })
        .extend({ failed: z.boolean().optional() })
    )
    .optional(),
});

/** Offline decoder only: archived pre-wrapper facts never authorize a new call. */
export const legacyModelReceipts = (raw: unknown, childSessionId?: string) => {
  const event = envelope.parse(raw);
  const id =
    typeof childSessionId === "string" && childSessionId !== ""
      ? `eve-child:${childSessionId}:${event.meta.id}`
      : event.meta.id;
  if (event.type === "hook.result") {
    const data = hookUsage.parse(event.data);
    return (data.modelCalls ?? []).map((call, index) => ({
      eventId: `${id}:model-call:${index}`,
      turnId: data.turnId,
      costUsd: cost(call.usage?.costUsd),
      generationId: call.providerMetadata?.gateway?.generationId,
      // Failed calls used to be classified as zero, without provider evidence.
      unresolvedFailure:
        call.failed === true && cost(call.usage?.costUsd) === undefined,
    }));
  }
  if (
    event.type === "step.completed" ||
    event.type === "compaction.usage" ||
    event.type === "step.failed"
  ) {
    const data = modelUsage.parse(event.data);
    return [
      {
        eventId: id,
        turnId: data.turnId,
        costUsd: cost(data.usage?.costUsd),
        generationId: data.providerMetadata?.gateway?.generationId,
        unresolvedFailure:
          event.type === "step.failed" &&
          cost(data.usage?.costUsd) === undefined,
      },
    ];
  }
  return [];
};

const action = z.object({
  turnId: z.string(),
  status: z.string(),
  result: z.object({
    kind: z.string(),
    callId: z.string().optional(),
    output: z.unknown().optional(),
  }),
});

export const legacyToolReceipts = (raw: unknown, sessionId: string) => {
  const event = envelope.parse(raw);
  if (event.type !== "action.result") {
    return [];
  }
  const data = action.parse(event.data);
  if (
    data.result.kind !== "tool-result" ||
    !hasEveToolReceipt(data.result.output)
  ) {
    return [];
  }
  if (data.result.callId === undefined || data.result.callId === "") {
    throw new Error("Archived tool receipt has no call identity.");
  }
  const result = toolResultSchema.safeParse(data.result.output);
  const recordedCost = result.success ? result.data.usage.costUsd : undefined;
  return [
    {
      eventId: `eve-tool:${sessionId}:${data.result.callId}`,
      turnId: data.turnId,
      costUsd: data.status === "rejected" ? 0 : recordedCost,
      generationId: undefined,
      unresolvedFailure: false,
    },
  ];
};
