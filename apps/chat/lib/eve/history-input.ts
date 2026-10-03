import { z } from "zod";

/* oxlint-disable no-magic-numbers --
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
/* oxlint-enable no-magic-numbers */

export type EveHistoryInput = z.infer<typeof eveHistoryInput>;
