import { z } from "zod";

const MIN_MODEL_ID_LENGTH = 1;
const MAX_MODEL_ID_LENGTH = 200;

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (eveCopyInput); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const eveCopyInput = z.strictObject({
  modelId: z.string().min(MIN_MODEL_ID_LENGTH).max(MAX_MODEL_ID_LENGTH),
  operationId: z.uuid().transform((id) => id.toLowerCase()),
  sourceConversationId: z.uuid().transform((id) => id.toLowerCase()),
});
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (EveCopyInput); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type EveCopyInput = z.infer<typeof eveCopyInput>;
/* oxlint-enable import/no-named-export */
