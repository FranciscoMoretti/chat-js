import { z } from "zod";

const candidate = z.object({ operationId: z.uuid(), modelId: z.string() });
export const eveResponseGroupResult = z.object({
  id: z.uuid(),
  candidates: z.array(
    z.discriminatedUnion("state", [
      candidate.extend({
        state: z.literal("bound"),
        conversationId: z.uuid(),
        sessionId: z.string().min(1),
      }),
      candidate.extend({ state: z.literal("unresolved") }),
      candidate.extend({ state: z.literal("waiting") }),
      candidate.extend({
        state: z.literal("rejected"),
        error: z.string(),
        code: z.literal("project_not_found").optional(),
      }),
    ])
  ),
});
export type EveResponseGroupResult = z.infer<typeof eveResponseGroupResult>;
