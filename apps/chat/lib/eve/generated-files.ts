/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-files"; "../file-storage" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { ToolContext } from "eve/tools";

import {
  reserveEveGeneratedFile,
  writeEveGeneratedFile,
} from "../db/eve-files";
import { createFileId, uploadFileAtKey } from "../file-storage";
import type { FileUploader } from "../file-storage";
import { resolveEveConversationScope } from "./conversation-scope";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

/* oxlint-disable import/no-named-export, import/prefer-default-export, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types --
 * import/no-named-export (#527): Preserve the named eveGeneratedFileUploader API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): eveGeneratedFileUploader remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * oxc/no-async-await (#540): eveGeneratedFileUploader sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): eveGeneratedFileUploader handles optional context.session.auth.initiator?.principalId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): eveGeneratedFileUploader accepts context: Pick<ToolContext, "abortSignal"> & { session?: { id: string; auth: { ; body; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const eveGeneratedFileUploader =
  (
    context: Pick<ToolContext, "abortSignal"> & {
      session?: {
        id: string;
        auth: {
          initiator?: {
            principalId: string;
          } | null;
        };
      };
    }
  ): FileUploader =>
  async (filename, body, contentType) => {
    if (!context.session) {
      throw new Error("Generated files require a native session.");
    }
    const scope = await resolveEveConversationScope(
      context.session.auth.initiator?.principalId,
      context.session.id,
      context.abortSignal
    );
    const key = createFileId();
    await reserveEveGeneratedFile(scope.ownerId, scope.conversationId, key);
    return await writeEveGeneratedFile(
      scope.ownerId,
      scope.conversationId,
      key,
      async () => {
        context.abortSignal.throwIfAborted();
        return await uploadFileAtKey(key, filename, body, contentType);
      }
    );
  };
/* oxlint-enable import/no-named-export, import/prefer-default-export, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types */
