import type { ToolContext } from "eve/tools";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import {
  getEveDocumentRevision,
  saveEveDocumentRevision,
} from "@/lib/db/eve-documents";
import { isAccountSession } from "./session-identity";
import { resolveEveConversationScope } from "./conversation-scope";

export type DocumentToolContext = ReadonlyNativeSurface<
  Pick<ToolContext, "session" | "abortSignal" | "callId">
>;
export type DocumentWrite = Omit<
  Parameters<typeof saveEveDocumentRevision>[0],
  "ownerId" | "conversationId"
>;
export type DocumentRevision = Pick<
  NonNullable<Awaited<ReturnType<typeof getEveDocumentRevision>>>,
  "id" | "documentId" | "createdAt" | "title" | "kind" | "content" | "fileIds"
>;
export interface DocumentRepository {
  readonly read: (documentId: string) => Promise<DocumentRevision | undefined>;
  readonly save: (input: DocumentWrite) => Promise<DocumentRevision>;
}

export const documentRepository = async (
  context: DocumentToolContext
): Promise<DocumentRepository> => {
  if (!isAccountSession(context.session)) {
    const { findSessionProfile } = await import("./session-profile");
    const factory = findSessionProfile(context.session)?.documents;
    if (factory === undefined) {
      throw new Error("Documents are unavailable for this session.");
    }
    return await factory(context);
  }
  const { current } = context.session.auth;
  if (
    current?.authenticator !== "chatjs-gateway" ||
    current.principalId !== context.session.auth.initiator?.principalId
  ) {
    throw new Error(
      "Document access requires the current account owner's authority."
    );
  }
  const scope = await resolveEveConversationScope(
    current.principalId,
    context.session.id,
    context.abortSignal
  );
  return {
    read: async (documentId) =>
      (await getEveDocumentRevision(
        scope.ownerId,
        scope.conversationId,
        documentId
      )) ?? undefined,
    save: async (input) =>
      await saveEveDocumentRevision(
        { ...input, ...scope },
        context.abortSignal
      ),
  };
};
