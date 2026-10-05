import { z } from "zod";

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (eveCopyInput); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): eveCopyInput uses 1, 200 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export const eveCopyInput = z.strictObject({
  modelId: z.string().min(1).max(200),
  operationId: z.uuid().transform((id) => id.toLowerCase()),
  sourceConversationId: z.uuid().transform((id) => id.toLowerCase()),
});
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (EveCopyInput); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-magic-numbers */
export type EveCopyInput = z.infer<typeof eveCopyInput>;
/* oxlint-enable import/no-named-export */
