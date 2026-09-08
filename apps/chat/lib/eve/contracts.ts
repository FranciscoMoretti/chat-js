import { z } from "zod";

export const createConversationInput = z
  .object({
    operationId: z.uuid(),
    message: z.string().trim().min(1).max(16_000),
  })
  .strict();
export const conversationBinding = z.object({
  id: z.uuid(),
  sessionId: z.string().min(1),
});
export const noteInput = z.object({ note: z.string().trim().min(1).max(500) });
export const noteOutput = noteInput.extend({ confirmed: z.literal(true) });
