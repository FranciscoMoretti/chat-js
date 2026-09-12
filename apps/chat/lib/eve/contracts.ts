import { z } from "zod";
import { eveMessageInput } from "./message-input";

export const eveForkInput = z.union([
  z
    .object({
      conversationId: z.uuid(),
      checkpointId: z.uuid().optional(),
      beforeTurnId: z
        .string()
        .max(64)
        .regex(/^turn_(0|[1-9][0-9]*)$/),
      beforeMessageId: z.never().optional(),
    })
    .strict(),
  z
    .object({
      conversationId: z.uuid(),
      beforeMessageId: z.string().regex(/^seed_message_(0|[1-9][0-9]{0,3})$/),
      beforeTurnId: z.never().optional(),
      checkpointId: z.never().optional(),
    })
    .strict(),
]);
export type EveForkInput = z.infer<typeof eveForkInput>;

export const createConversationInput = z
  .object({
    operationId: z.uuid(),
    modelId: z.string().min(1).max(200).optional(),
    message: eveMessageInput,
    fork: eveForkInput.optional(),
    projectId: z.uuid().optional(),
  })
  .strict()
  .refine((input) => !(input.fork && input.projectId), {
    message: "Forks inherit their source conversation project.",
  });
export const conversationBinding = z.object({
  id: z.uuid(),
  sessionId: z.string().min(1),
});
export const noteInput = z.object({ note: z.string().trim().min(1).max(500) });
export const noteOutput = noteInput.extend({ confirmed: z.literal(true) });
