import { and, eq } from "drizzle-orm";

import { db } from "./client";
import { lockEveCopyOwners } from "./eve-copy-journal";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, eveFileReference, eveStoredFile } from "./schema";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (readPublicEveCopyFile); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readPublicEveCopyFile's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable typescript/strict-boolean-expressions --
 * typescript/strict-boolean-expressions (#610): readPublicEveCopyFile intentionally keeps the existing falsy-value behavior of reference; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- lockEveCopyOwners requires the complete native Drizzle transaction to retain transaction-bound lock provenance; mapped readonly views erase protected schema/nestedIndex, while shallow readonly leaves mutable session/table metadata.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/strict-boolean-expressions */
