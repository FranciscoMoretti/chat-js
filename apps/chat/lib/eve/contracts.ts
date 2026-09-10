import { z } from "zod";
import { eveMessageInput } from "./message-input";

export const eveForkInput = z
  .object({
    conversationId: z.uuid(),
    beforeTurnId: z
      .string()
      .max(64)
      .regex(/^turn_(0|[1-9][0-9]*)$/),
  })
  .strict();
export type EveForkInput = z.infer<typeof eveForkInput>;

export const createConversationInput = z
  .object({
    operationId: z.uuid(),
    modelId: z.string().min(1).max(200).optional(),
    message: eveMessageInput,
    fork: eveForkInput.optional(),
  })
  .strict();
export const conversationBinding = z.object({
  id: z.uuid(),
  sessionId: z.string().min(1),
});
export const noteInput = z.object({ note: z.string().trim().min(1).max(500) });
export const noteOutput = noteInput.extend({ confirmed: z.literal(true) });
