/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { frontendToolsSchema } from "@/lib/ai/types";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveForkInput } from "./contracts";
/* oxlint-enable sort-imports */
import { eveMessageInput } from "./message-input";

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * no-magic-numbers (#517): eveResponseGroupInput uses 1, 200, 2 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): eveResponseGroupInput accepts input; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): eveResponseGroupInput intentionally keeps the existing falsy-value behavior of input.projectId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const eveResponseGroupInput = z
  .object({
    operationId: z.uuid(),
    modelIds: z.array(z.string().min(1).max(200)).min(2),
    message: eveMessageInput,
    selectedTool: frontendToolsSchema.optional(),
    fork: eveForkInput.optional(),
    forkKind: z.enum(["edit", "comparison"]).optional(),
    projectId: z.uuid().optional(),
  })
  .strict()
  .refine(
    (input) => !(input.fork && input.projectId),
    "Forks inherit their source project."
  )
  .refine(
    (input) => !input.forkKind || input.fork,
    "Fork intent requires a source conversation."
  )
  .transform((input) => ({
    ...input,
    operationId: input.operationId.toLowerCase(),
  }));
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
