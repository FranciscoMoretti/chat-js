import { z } from "zod";

const candidate = z.object({ modelId: z.string(), operationId: z.uuid() });
export const eveResponseGroupResult = z.object({
  candidates: z.array(
    z.discriminatedUnion("state", [
      candidate.extend({
        conversationId: z.uuid(),
        sessionId: z.string().min(1),
        state: z.literal("bound"),
      }),
      candidate.extend({ state: z.literal("unresolved") }),
      candidate.extend({ state: z.literal("waiting") }),
      candidate.extend({
        code: z.literal("project_not_found").optional(),
        error: z.string(),
        state: z.literal("rejected"),
      }),
    ])
  ),
  id: z.uuid(),
});
export type EveResponseGroupResult = z.infer<typeof eveResponseGroupResult>;
