/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { frontendToolsSchema } from "@/lib/ai/types";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveForkInput } from "./contracts";
/* oxlint-enable sort-imports */
import { eveMessageInput } from "./message-input";
// oxlint-disable-next-line eslint/sort-imports -- Preserve runtime module evaluation order and keep type-only declarations beside the owning module; the pinned binding-order rule requires a different grouping.
import type { ReadonlyEveMessageInput } from "./readonly-message-types";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (eveResponseGroupInput); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable no-magic-numbers, typescript/strict-boolean-expressions -- * no-magic-numbers (#517): eveResponseGroupInput uses 1, 200, 2 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/strict-boolean-expressions (#610): eveResponseGroupInput intentionally keeps the existing falsy-value behavior of input.projectId; distinguishing empty, zero, and absent states requires a domain behavior decision. */
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
    (input: { readonly fork?: unknown; readonly projectId?: string }) =>
      !(input.fork && input.projectId),
    "Forks inherit their source project."
  )
  .refine(
    (input: {
      readonly forkKind?: "edit" | "comparison";
      readonly fork?: unknown;
    }) => !input.forkKind || input.fork,
    "Fork intent requires a source conversation."
  )
  .transform(
    (
      input: ReadonlyNativeSurface<{
        operationId: string;
        modelIds: string[];
        selectedTool?:
          | "deepResearch"
          | "createTextDocument"
          | "createCodeDocument"
          | "createSheetDocument"
          | "editTextDocument"
          | "editCodeDocument"
          | "editSheetDocument"
          | "webSearch"
          | "generateImage"
          | "generateVideo"
          | undefined;
        fork?:
          | {
              conversationId: string;
              beforeTurnId: string;
              checkpointId?: string | undefined;
              beforeMessageId?: undefined;
            }
          | {
              conversationId: string;
              beforeMessageId: string;
              beforeTurnId?: undefined;
              checkpointId?: undefined;
            }
          | undefined;
        forkKind?: "edit" | "comparison" | undefined;
        projectId?: string | undefined;
      }> & { readonly message: ReadonlyEveMessageInput }
    ) => ({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...input,
      operationId: input.operationId.toLowerCase(),
    })
  );
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable no-magic-numbers, typescript/strict-boolean-expressions */
