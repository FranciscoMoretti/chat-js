import { z } from "zod";

const MIN_OWNER_SCOPE_LENGTH = 1;
const MAX_OWNER_SCOPE_LENGTH = 128;
const MAX_HISTORY_SEARCH_LENGTH = 255;

export const eveHistoryInput = z.object({
  cursor: z
    .object({
      id: z.uuid(),
      isPinned: z.boolean(),
      updatedAt: z.iso.datetime(),
    })
    .nullish(),
  ownerScope: z
    .string()
    .min(MIN_OWNER_SCOPE_LENGTH)
    .max(MAX_OWNER_SCOPE_LENGTH)
    .optional(),
  projectId: z.uuid().nullable().optional(),
  search: z.string().trim().max(MAX_HISTORY_SEARCH_LENGTH).default(""),
});

export type EveHistoryInput = z.infer<typeof eveHistoryInput>;
