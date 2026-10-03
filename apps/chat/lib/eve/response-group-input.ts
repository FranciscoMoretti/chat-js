/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { z } from "zod";

import { frontendToolsSchema } from "../ai/types";
import { eveForkInput } from "./contracts";
import { eveMessageInput } from "./message-input";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * import/no-named-export (#527): Preserve the named eveResponseGroupInput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): eveResponseGroupInput remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * no-magic-numbers (#517): eveResponseGroupInput uses 1, 200, 2 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-rest-spread-properties (#543): eveResponseGroupInput copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
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
