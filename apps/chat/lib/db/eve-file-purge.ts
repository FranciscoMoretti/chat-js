import {
  and,
  eq,
  inArray,
  ne,
  notExists,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { db } from "./client";
import { eveConversation, eveFileReference, eveStoredFile } from "./schema";

/** Fence exclusively referenced files before external deletion; retain references for retries. */
export async function prepareEveFamilyFilePurge(
  ownerId: string,
  rootId: string
) {
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const ids = await deletingFamilyIds(tx, ownerId, rootId);
    const referencedKeys = tx
      .select({ key: eveFileReference.key })
      .from(eveFileReference)
      .where(inArray(eveFileReference.conversationId, ids));
    const survivingReference = tx
      .select({ key: eveFileReference.key })
      .from(eveFileReference)
      .where(
        and(
          eq(eveFileReference.key, eveStoredFile.key),
          notInArray(eveFileReference.conversationId, ids)
        )
      );
    const files = await tx
      .update(eveStoredFile)
      .set({ state: "deleting" })
      .where(
        and(
          eq(eveStoredFile.ownerId, ownerId),
          ne(eveStoredFile.state, "deleted"),
          inArray(eveStoredFile.key, referencedKeys),
          notExists(survivingReference)
        )
      )
      .returning({ key: eveStoredFile.key });
    return files.map((file) => file.key).sort();
  });
}

/** Call only after the provider confirms removal; no file identity is recycled. */
export async function completeEveFilePurge(ownerId: string, keys: string[]) {
  if (!keys.length) {
    return;
  }
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    await tx
      .update(eveStoredFile)
      .set({ state: "deleted" })
      .where(
        and(
          eq(eveStoredFile.ownerId, ownerId),
          eq(eveStoredFile.state, "deleting"),
          inArray(eveStoredFile.key, keys)
        )
      );
  });
}

async function deletingFamilyIds(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerId: string,
  rootId: string
) {
  const family = await tx
    .select({
      id: eveConversation.id,
      root: eveConversation.rootConversationId,
      state: eveConversation.state,
    })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        or(
          eq(eveConversation.id, rootId),
          eq(eveConversation.rootConversationId, rootId)
        )
      )
    );
  if (
    !family.some((row) => row.id === rootId && row.root === null) ||
    family.some((row) => row.state !== "deleting")
  ) {
    throw new Error("The entire conversation family must be pending deletion.");
  }
  return family.map((row) => row.id);
}

/** Release references only after file cleanup; retry cleanup if another family released first. */
export async function releaseEveFamilyFileReferences(
  ownerId: string,
  rootId: string
) {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const ids = await deletingFamilyIds(tx, ownerId, rootId);
    const outsideReference = tx
      .select({ key: eveFileReference.key })
      .from(eveFileReference)
      .where(
        and(
          eq(eveFileReference.key, eveStoredFile.key),
          notInArray(eveFileReference.conversationId, ids)
        )
      );
    const [unremoved] = await tx
      .select({ key: eveStoredFile.key })
      .from(eveStoredFile)
      .where(
        and(
          eq(eveStoredFile.ownerId, ownerId),
          ne(eveStoredFile.state, "deleted"),
          inArray(
            eveStoredFile.key,
            tx
              .select({ key: eveFileReference.key })
              .from(eveFileReference)
              .where(inArray(eveFileReference.conversationId, ids))
          ),
          notExists(outsideReference)
        )
      )
      .limit(1);
    if (unremoved) {
      throw new Error(
        "File cleanup is incomplete. Retry before releasing references."
      );
    }
    await tx
      .delete(eveFileReference)
      .where(
        and(
          eq(eveFileReference.ownerId, ownerId),
          inArray(eveFileReference.conversationId, ids)
        )
      );
  });
}
