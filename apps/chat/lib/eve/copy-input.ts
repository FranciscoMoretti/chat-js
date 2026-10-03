import { z } from "zod";

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): eveCopyInput uses 1, 200 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export const eveCopyInput = z.strictObject({
  modelId: z.string().min(1).max(200),
  operationId: z.uuid().transform((id) => id.toLowerCase()),
  sourceConversationId: z.uuid().transform((id) => id.toLowerCase()),
});
/* oxlint-enable no-magic-numbers */
export type EveCopyInput = z.infer<typeof eveCopyInput>;
