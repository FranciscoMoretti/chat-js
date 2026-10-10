import {
  reserveEveGeneratedFile,
  writeEveGeneratedFile,
} from "@/lib/db/eve-files";
/* oxlint-disable sort-imports -- Keep DB/env initialization before storage config parsing; alphabetical binding order reverses validation and allocation order. */
import { createFileId, uploadFileAtKey } from "@/lib/file-storage";
/* oxlint-enable sort-imports */
import type { FileUploader } from "@/lib/file-storage";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ToolContext } from "eve/tools";
import { resolveEveConversationScope } from "./conversation-scope";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (eveGeneratedFileUploader); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve eveGeneratedFileUploader's awaited sequencing and rejected-Promise behavior. */

export const eveGeneratedFileUploader =
  (
    context: ReadonlyNativeSurface<
      Pick<ToolContext, "abortSignal"> & {
        readonly session?: {
          readonly id: string;
          readonly auth: {
            readonly initiator?: {
              readonly principalId: string;
            } | null;
          };
        };
      }
    >
  ): FileUploader =>
  async (filename, body, contentType) => {
    if (!context.session) {
      throw new Error("Generated files require a native session.");
    }
    const scope = await resolveEveConversationScope(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading principalId from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
