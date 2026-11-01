import { z } from "zod";

const MIN_MODEL_ID_LENGTH = 1;
const MAX_MODEL_ID_LENGTH = 200;

export const eveCopyInput = z.strictObject({
  modelId: z.string().min(MIN_MODEL_ID_LENGTH).max(MAX_MODEL_ID_LENGTH),
  operationId: z.uuid().transform((id) => id.toLowerCase()),
  sourceConversationId: z.uuid().transform((id) => id.toLowerCase()),
});
export type EveCopyInput = z.infer<typeof eveCopyInput>;
