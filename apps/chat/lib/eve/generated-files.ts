import type { ToolContext } from "eve/tools";

import {
  reserveEveGeneratedFile,
  writeEveGeneratedFile,
} from "../db/eve-files";
import {
  createFileStorageKey,
  type uploadFile,
  uploadFileAtKey,
} from "../file-storage";
import { resolveEveConversationScope } from "./conversation-scope";

export function eveGeneratedFileUploader(
  context: Pick<ToolContext, "abortSignal"> & {
    session?: {
      id: string;
      auth: { initiator?: { principalId: string } | null };
    };
  }
): typeof uploadFile {
  return async (filename, body, contentType) => {
    if (!context.session) {
      throw new Error("Generated files require a native session.");
    }
    const scope = await resolveEveConversationScope(
      context.session.auth.initiator?.principalId,
      context.session.id,
      context.abortSignal
    );
    const key = createFileStorageKey(filename);
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
}
