import { z } from "zod";

/* oxlint-disable import/no-named-export, no-magic-numbers --
 * import/no-named-export (#527): Preserve the named eveCopyInput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): eveCopyInput uses 1, 200 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export const eveCopyInput = z.strictObject({
  modelId: z.string().min(1).max(200),
  operationId: z.uuid().transform((id) => id.toLowerCase()),
  sourceConversationId: z.uuid().transform((id) => id.toLowerCase()),
});
/* oxlint-enable import/no-named-export, no-magic-numbers */
/* oxlint-disable import/no-named-export --
 * import/no-named-export (#527): Preserve the named EveCopyInput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type EveCopyInput = z.infer<typeof eveCopyInput>;
/* oxlint-enable import/no-named-export */
