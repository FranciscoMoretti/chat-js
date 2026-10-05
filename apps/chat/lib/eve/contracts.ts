/* oxlint-disable eslint/sort-keys -- Schema order defines persisted admission hashes; retain the original wire representation. */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { frontendToolsSchema } from "@/lib/ai/types";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveMessageInput } from "./message-input";
/* oxlint-enable sort-imports */

/* oxlint-disable no-magic-numbers -- no-magic-numbers (#517): eveForkInput uses 64 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
const eveForkInput = z.union([
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
/* oxlint-enable no-magic-numbers */

type EveForkInput = z.infer<typeof eveForkInput>;

const eveForkKind = z.enum(["edit", "regenerate", "comparison"]);

type EveForkKind = z.infer<typeof eveForkKind>;

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- no-magic-numbers (#517): createConversationInput uses 1, 200 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): createConversationInput accepts input; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): createConversationInput intentionally keeps the existing falsy-value behavior of input.projectId; distinguishing empty, zero, and absent states requires a domain behavior decision. */
const createConversationInput = z
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
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
/* oxlint-disable no-magic-numbers -- no-magic-numbers (#517): conversationBinding uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
const conversationBinding = z.object({
  id: z.uuid(),
  sessionId: z.string().min(1),
});
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (conversationBinding, createConversationInput, eveForkInput, eveForkKind); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-magic-numbers */
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
