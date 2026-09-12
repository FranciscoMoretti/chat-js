import { z } from "zod";

export const eveCopyInput = z.strictObject({
  sourceConversationId: z.uuid().transform((id) => id.toLowerCase()),
  operationId: z.uuid().transform((id) => id.toLowerCase()),
  modelId: z.string().min(1).max(200),
});
export type EveCopyInput = z.infer<typeof eveCopyInput>;
