import { z } from "zod";

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (eveHistoryInput); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
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
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (EveHistoryInput); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-magic-numbers */

export type EveHistoryInput = z.infer<typeof eveHistoryInput>;
/* oxlint-enable import/no-named-export */
