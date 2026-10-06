/* oxlint-disable eslint/sort-keys -- Schema order defines persisted admission hashes; retain the original wire representation. */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module order and Oxfmt's type/value grouping; sort-imports requires a different declaration order. */
import { frontendToolsSchema } from "@/lib/ai/types";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */

import { eveMessageInput } from "./message-input";

const MAX_FORK_TURN_ID_LENGTH = 64;
const MIN_IDENTIFIER_LENGTH = 1;
const MAX_MODEL_IDENTIFIER_LENGTH = 200;

const eveForkInput = z.union([
  z
    .object({
      conversationId: z.uuid(),
      checkpointId: z.uuid().optional(),
      beforeTurnId: z
        .string()
        .max(MAX_FORK_TURN_ID_LENGTH)
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (conversationBinding, createConversationInput, eveForkInput, eveForkKind); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export {
  conversationBinding,
  createConversationInput,
  eveForkInput,
  eveForkKind,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (EveForkInput, EveForkKind); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { EveForkInput, EveForkKind };
/* oxlint-enable import/no-named-export */
