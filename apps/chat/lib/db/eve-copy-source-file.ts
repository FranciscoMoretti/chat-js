import { and, eq } from "drizzle-orm";

import { db } from "./client";
import { lockEveCopyOwners } from "./eve-copy-journal";
import { eveConversation, eveFileReference, eveStoredFile } from "./schema";

/** Read only active files retained by this exact public source; supplied URLs are not authority. */
export const readPublicEveCopyFile = async (
  source: {
    id: string;
    ownerId: string;
    sessionId: string;
  },
  key: string,
  read: (key: string) => Promise<Pick<Blob, "type" | "arrayBuffer">>
) =>
  await db.transaction(async (tx) => {
    await lockEveCopyOwners(tx, [source.ownerId]);
    const [reference] = await tx
      .select({ key: eveStoredFile.key })
      .from(eveConversation)
      .innerJoin(
        eveFileReference,
        and(
          eq(eveFileReference.conversationId, eveConversation.id),
          eq(eveFileReference.ownerId, eveConversation.ownerId)
        )
      )
      .innerJoin(
        eveStoredFile,
        and(
          eq(eveStoredFile.key, eveFileReference.key),
          eq(eveStoredFile.ownerId, eveFileReference.ownerId)
        )
      )
      .where(
        and(
          eq(eveConversation.id, source.id),
          eq(eveConversation.ownerId, source.ownerId),
          eq(eveConversation.sessionId, source.sessionId),
          eq(eveConversation.state, "bound"),
          eq(eveConversation.visibility, "public"),
          eq(eveStoredFile.key, key),
          eq(eveStoredFile.state, "active")
        )
      )
      .for("share");
    if (!reference) {
      throw new Error("Published copy file is unavailable.");
    }
    const file = await read(reference.key);
    return new Blob([await file.arrayBuffer()], { type: file.type });
  });
