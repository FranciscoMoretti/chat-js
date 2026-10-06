import { z } from "zod";

const correlationData = z.object({
  correlationIds: z.array(z.string()).optional(),
});
const correlationIds = (data: unknown): readonly string[] =>
  correlationData.parse(data).correlationIds ?? [];
const acceptance = z.object({
  deliveryId: z.string().optional(),
  sessionId: z.string(),
});
const wireBody = z.record(z.string(), z.unknown());
const queueOptions = (
  correlationId: string
): { readonly correlationId: string; readonly turnPolicy: "queue" } => ({
  correlationId,
  turnPolicy: "queue",
});
export { acceptance, correlationIds, queueOptions, wireBody };
