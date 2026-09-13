import { z } from "zod";

export const eveCopyInput = z.strictObject({
  modelId: z.string().min(1).max(200),
  operationId: z.uuid().transform((id) => id.toLowerCase()),
  sourceConversationId: z.uuid().transform((id) => id.toLowerCase()),
});
export type EveCopyInput = z.infer<typeof eveCopyInput>;
