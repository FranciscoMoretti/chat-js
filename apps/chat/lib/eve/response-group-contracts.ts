import { z } from "zod";

const candidate = z.object({ modelId: z.string(), operationId: z.uuid() });
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (eveResponseGroupResult); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable no-magic-numbers, unicorn/max-nested-calls --
 * no-magic-numbers (#517): eveResponseGroupResult uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * unicorn/max-nested-calls (#568): eveResponseGroupResult keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (EveResponseGroupResult); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-magic-numbers, unicorn/max-nested-calls */
export type EveResponseGroupResult = z.infer<typeof eveResponseGroupResult>;
/* oxlint-enable import/no-named-export */
