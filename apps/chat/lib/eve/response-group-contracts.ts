import { z } from "zod";

const candidate = z.object({ modelId: z.string(), operationId: z.uuid() });
/* oxlint-disable import/no-named-export, no-magic-numbers, unicorn/max-nested-calls --
 * import/no-named-export (#527): Preserve the named eveResponseGroupResult API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
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
/* oxlint-enable import/no-named-export, no-magic-numbers, unicorn/max-nested-calls */
/* oxlint-disable import/no-named-export --
 * import/no-named-export (#527): Preserve the named EveResponseGroupResult API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type EveResponseGroupResult = z.infer<typeof eveResponseGroupResult>;
/* oxlint-enable import/no-named-export */
