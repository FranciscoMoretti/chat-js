import { and, eq } from "drizzle-orm";

import { db } from "./client";
import { lockEveCopyOwners } from "./eve-copy-journal";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, eveFileReference, eveStoredFile } from "./schema";
/* oxlint-enable sort-imports */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * jsdoc/require-param (#534): readPublicEveCopyFile's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): readPublicEveCopyFile's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/explicit-function-return-type (#560): Keep readPublicEveCopyFile's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep readPublicEveCopyFile's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): readPublicEveCopyFile accepts source: { id: string; ownerId: string; sessionId: string; }; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): readPublicEveCopyFile intentionally keeps the existing falsy-value behavior of reference; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
