import {
  reserveEveGeneratedFile,
  withEveConversationFile,
} from "@/lib/db/eve-files";
import { createHash } from "node:crypto";
import { createFileId, uploadFileAtKey } from "@/lib/file-storage";
import type { FileUploader } from "@/lib/file-storage";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ToolContext } from "eve/tools";
import { resolveEveConversationScope } from "./conversation-scope";

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
    >,
    options?: Readonly<{ idempotencyKey: string }>
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
    const key = options
      ? createHash("sha256")
          .update(JSON.stringify([scope.branchId, options.idempotencyKey]))
          .digest("base64url")
          .slice(0, 24)
      : createFileId();
    await (options
      ? reserveEveGeneratedFile(scope.ownerId, scope.branchId, key, {
          reuse: true,
        })
      : reserveEveGeneratedFile(scope.ownerId, scope.branchId, key));
    return await withEveConversationFile(
      scope.ownerId,
      scope.branchId,
      key,
      async () => {
        context.abortSignal.throwIfAborted();
        return await uploadFileAtKey(key, filename, body, contentType);
      }
    );
  };
