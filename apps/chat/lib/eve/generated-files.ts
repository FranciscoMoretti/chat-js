/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-files"; "../file-storage" dependency within this package instead of introducing an alias or barrel API.
 */
import type { ToolContext } from "eve/tools";

import {
  reserveEveGeneratedFile,
  writeEveGeneratedFile,
} from "../db/eve-files";
import { createFileId, uploadFileAtKey } from "../file-storage";
import type { FileUploader } from "../file-storage";
import { resolveEveConversationScope } from "./conversation-scope";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types --
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
