import type { ToolContext } from "eve/tools";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  reserveEveGeneratedFile,
  writeEveGeneratedFile,
} from "@/lib/db/eve-files";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createFileId, uploadFileAtKey } from "@/lib/file-storage";
/* oxlint-enable sort-imports */
import type { FileUploader } from "@/lib/file-storage";

import { resolveEveConversationScope } from "./conversation-scope";

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
