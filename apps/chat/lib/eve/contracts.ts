/* oxlint-disable eslint/sort-keys -- Schema order defines persisted admission hashes; retain the original wire representation. */
import { z } from "zod";

import { frontendToolsSchema } from "../ai/types";
import { eveMessageInput } from "./message-input";

export const eveForkInput = z.union([
  z
    .object({
      conversationId: z.uuid(),
      checkpointId: z.uuid().optional(),
      beforeTurnId: z
        .string()
        .max(64)
        .regex(/^turn_(?<turnIndex>0|[1-9][0-9]*)$/u),
      beforeMessageId: z.never().optional(),
    })
    .strict(),
  z
    .object({
      conversationId: z.uuid(),
      beforeMessageId: z
        .string()
        .regex(/^seed_message_(?<messageIndex>0|[1-9][0-9]{0,3})$/u),
      beforeTurnId: z.never().optional(),
      checkpointId: z.never().optional(),
    })
    .strict(),
]);
export type EveForkInput = z.infer<typeof eveForkInput>;

export const eveForkKind = z.enum(["edit", "regenerate", "comparison"]);
export type EveForkKind = z.infer<typeof eveForkKind>;

export const createConversationInput = z
  .object({
    operationId: z.uuid(),
    modelId: z.string().min(1).max(200).optional(),
    message: eveMessageInput,
    selectedTool: frontendToolsSchema.optional(),
    fork: eveForkInput.optional(),
    forkKind: eveForkKind.optional(),
    projectId: z.uuid().optional(),
  })
  .strict()
  .refine((input) => !(input.fork && input.projectId), {
    message: "Forks inherit their source conversation project.",
  })
  .refine((input) => !input.forkKind || input.fork, {
    message: "Fork intent requires a source conversation.",
  });
export const conversationBinding = z.object({
  id: z.uuid(),
  sessionId: z.string().min(1),
});
export const noteInput = z.object({ note: z.string().trim().min(1).max(500) });
export const noteOutput = noteInput.extend({ confirmed: z.literal(true) });
