import { z } from "zod";

export const eveHistoryInput = z.object({
  ownerScope: z.string().min(1).max(128).optional(),
  projectId: z.uuid().nullable().optional(),
  search: z.string().trim().max(255).default(""),
  cursor: z
    .object({
      id: z.uuid(),
      isPinned: z.boolean(),
      updatedAt: z.iso.datetime(),
    })
    .nullish(),
});

export type EveHistoryInput = z.infer<typeof eveHistoryInput>;
