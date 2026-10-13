import { and, eq } from "drizzle-orm";

import { db } from "./client";
import { lockEveCopyOwners } from "./eve-copy-journal";
import { eveConversation, eveFileReference, eveStoredFile } from "./schema";

type CopySourceTransaction = Readonly<Pick<typeof db, "execute" | "select">>;

const FIRST_ROW_INDEX = 0;

/** Read only active files retained by this exact public source; supplied URLs are not authority.
 * @param {{ readonly id: string; readonly ownerId: string; readonly sessionId: string }} source Exact public source identity whose owner is locked while its file reference is checked.
 * @param {string} key Stored file identity that must remain active and referenced by this bound public source.
 * @param {(key: string) => Promise<Pick<Blob, "type" | "arrayBuffer">>} read Storage reader invoked only after the ownership/reference checks succeed.
 * @returns {Promise<Blob>} A fresh Blob containing the authorized stored bytes and MIME type; rejects when the source reference is unavailable or reading fails.
 */
export const readPublicEveCopyFile = async (
  source: {
    readonly id: string;
    readonly ownerId: string;
    readonly sessionId: string;
  },
  key: string,
  read: (key: string) => Promise<Pick<Blob, "type" | "arrayBuffer">>
): Promise<Blob> =>
  await db.transaction(async (tx: CopySourceTransaction) => {
    await lockEveCopyOwners(tx, [source.ownerId]);
    const referenceRows = await tx
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
    const reference = referenceRows.at(FIRST_ROW_INDEX);
    if (!reference) {
      throw new Error("Published copy file is unavailable.");
    }
    const file = await read(reference.key);
    return new Blob([await file.arrayBuffer()], { type: file.type });
  });
