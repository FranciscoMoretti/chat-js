import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { eveMessageInput } from "./message-input";
import { frontendToolsSchema } from "@/lib/ai/types";
import { z } from "zod";

const MIN_IDENTIFIER_LENGTH = 1;
const MAX_MODEL_IDENTIFIER_LENGTH = 200;

const eveForkInput = z.strictObject({ conversationId: z.uuid() });

type EveForkInput = z.infer<typeof eveForkInput>;

const eveForkKind = z.enum(["edit", "regenerate", "comparison"]);

type EveForkKind = z.infer<typeof eveForkKind>;

const createConversationBase = z
  .object({
    operationId: z.uuid(),
    modelId: z
      .string()
      .min(MIN_IDENTIFIER_LENGTH)
      .max(MAX_MODEL_IDENTIFIER_LENGTH)
      .optional(),
    message: eveMessageInput,
    selectedTool: frontendToolsSchema.optional(),
    fork: eveForkInput.optional(),
    forkKind: eveForkKind.optional(),
    projectId: z.uuid().optional(),
  })
  .strict();

type CreateConversationInput = z.output<typeof createConversationBase>;

const createConversationInput = createConversationBase
  .refine(
    (input: ReadonlyNativeSurface<CreateConversationInput>) =>
      !(
        typeof input.fork === "object" &&
        typeof input.projectId === "string" &&
        input.projectId.length >= MIN_IDENTIFIER_LENGTH
      ),
    {
      message: "Forks inherit their source conversation project.",
    }
  )
  .refine(
    (input: ReadonlyNativeSurface<CreateConversationInput>) =>
      !(
        typeof input.forkKind === "string" &&
        input.forkKind.length >= MIN_IDENTIFIER_LENGTH &&
        typeof input.fork !== "object"
      ),
    {
      message: "Fork intent requires a source conversation.",
    }
  );
const conversationBinding = z.object({
  id: z.uuid(),
  sessionId: z.string().min(MIN_IDENTIFIER_LENGTH),
});
export {
  conversationBinding,
  createConversationInput,
  eveForkInput,
  eveForkKind,
};
export type { EveForkInput, EveForkKind };
