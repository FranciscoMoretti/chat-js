/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/sort-keys -- Schema order defines persisted admission hashes; retain the original wire representation. */
import { z } from "zod";

import { frontendToolsSchema } from "../ai/types";
import { eveMessageInput } from "./message-input";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/group-exports, no-magic-numbers  --
 * import/group-exports (#523): eveForkInput stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveForkInput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): eveForkInput uses 64 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
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
/* oxlint-enable import/group-exports, no-magic-numbers */
/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): EveForkInput stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named EveForkInput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type EveForkInput = z.infer<typeof eveForkInput>;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): eveForkKind stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveForkKind API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const eveForkKind = z.enum(["edit", "regenerate", "comparison"]);
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): EveForkKind stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named EveForkKind API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type EveForkKind = z.infer<typeof eveForkKind>;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * import/group-exports (#523): createConversationInput stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named createConversationInput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): createConversationInput uses 1, 200 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): createConversationInput accepts input; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): createConversationInput intentionally keeps the existing falsy-value behavior of input.projectId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
/* oxlint-enable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
/* oxlint-disable import/group-exports, no-magic-numbers  --
 * import/group-exports (#523): conversationBinding stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named conversationBinding API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): conversationBinding uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export const conversationBinding = z.object({
  id: z.uuid(),
  sessionId: z.string().min(1),
});
/* oxlint-enable import/group-exports, no-magic-numbers */
