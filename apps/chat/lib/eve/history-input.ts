import { z } from "zod";

/* oxlint-disable import/no-named-export, no-magic-numbers --
 * import/no-named-export (#527): Preserve the named eveHistoryInput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): eveHistoryInput uses 1, 128, 255 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export const eveHistoryInput = z.object({
  cursor: z
    .object({
      id: z.uuid(),
      isPinned: z.boolean(),
      updatedAt: z.iso.datetime(),
    })
    .nullish(),
  ownerScope: z.string().min(1).max(128).optional(),
  projectId: z.uuid().nullable().optional(),
  search: z.string().trim().max(255).default(""),
});
/* oxlint-enable import/no-named-export, no-magic-numbers */

/* oxlint-disable import/no-named-export --
 * import/no-named-export (#527): Preserve the named EveHistoryInput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type EveHistoryInput = z.infer<typeof eveHistoryInput>;
/* oxlint-enable import/no-named-export */
