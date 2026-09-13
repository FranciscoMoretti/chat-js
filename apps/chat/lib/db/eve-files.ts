import { and, eq, inArray, sql } from "drizzle-orm";

import { FILE_CONTENT_PATH, isFileStorageKey } from "../file-url";
import { db } from "./client";
import { eveConversation, eveFileReference, eveStoredFile } from "./schema";

/** Legacy keys have no EVE row; only EVE deletion fences deny an existing URL. */
export async function isEveFileUnavailable(key: string) {
  const [file] = await db
    .select({ state: eveStoredFile.state })
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, key));
  return file !== undefined && file.state !== "active";
}

const DOCUMENT_FILE_URL = new RegExp(
  `${FILE_CONTENT_PATH}\\?key=([A-Za-z0-9_-]{24}(?:\\.[a-z0-9]{1,10})?)`,
  "g"
);

/** Reserve a fresh upload before storage I/O; never overwrite an existing key. */
export async function reserveEveUpload(ownerId: string, key: string) {
  if (!(ownerId && isFileStorageKey(key))) {
    throw new Error("Invalid upload ownership reservation.");
  }
  await db.insert(eveStoredFile).values({ ownerId, key });
}

/** Serialize admitted storage writes with orphan cleanup and reference creation. */
export async function writeEveUpload<T>(
  ownerId: string,
  key: string,
  write: () => Promise<T>
) {
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [file] = await tx
      .select({ key: eveStoredFile.key })
      .from(eveStoredFile)
      .where(
        and(
          eq(eveStoredFile.key, key),
          eq(eveStoredFile.ownerId, ownerId),
          eq(eveStoredFile.state, "active")
        )
      );
    if (!file) {
      throw new Error("Upload reservation is unavailable.");
    }
    return await write();
  });
}

/** Register server-created keys only; a caller-supplied URL is not ownership proof. */
export async function registerEveStoredFile(ownerId: string, key: string) {
  if (!(ownerId && isFileStorageKey(key))) {
    throw new Error("Invalid file ownership registration.");
  }
  await db.insert(eveStoredFile).values({ ownerId, key }).onConflictDoNothing();
  const [saved] = await db
    .select({ ownerId: eveStoredFile.ownerId, state: eveStoredFile.state })
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, key));
  if (saved?.ownerId !== ownerId || saved.state !== "active") {
    throw new Error("File ownership cannot be reassigned.");
  }
}

/** Claim before dispatch; failed/uncertain sends retain their references safely. */
export async function referenceEveFiles(
  ownerId: string,
  conversationId: string,
  keys: string[]
) {
  const uniqueKeys = [...new Set(keys)].sort();
  if (uniqueKeys.length === 0) {
    return;
  }
  if (
    uniqueKeys.length > 16 ||
    uniqueKeys.some((key) => !isFileStorageKey(key))
  ) {
    throw new Error("Invalid attachment references.");
  }
  await db.transaction(async (tx) => {
    // Serializes with deletion and fork reservation, before observing state.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [conversation] = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId)
        )
      );
    if (
      !(
        conversation &&
        ["creating", "uncertain", "bound"].includes(conversation.state)
      )
    ) {
      throw new Error("Conversation is unavailable for attachments.");
    }
    const files = await tx
      .select({ key: eveStoredFile.key })
      .from(eveStoredFile)
      .where(
        and(
          eq(eveStoredFile.ownerId, ownerId),
          eq(eveStoredFile.state, "active"),
          inArray(eveStoredFile.key, uniqueKeys)
        )
      )
      .for("share");
    if (files.length !== uniqueKeys.length) {
      throw new Error("Attachment is not owned by this user.");
    }
    await tx
      .insert(eveFileReference)
      .values(uniqueKeys.map((key) => ({ key, ownerId, conversationId })))
      .onConflictDoNothing();
  });
}

/** Preflight rejects invalid initial input before a creation reservation exists. */
export async function assertEveFilesOwned(ownerId: string, keys: string[]) {
  const uniqueKeys = [...new Set(keys)];
  if (!uniqueKeys.length) {
    return;
  }
  if (
    uniqueKeys.length > 16 ||
    uniqueKeys.some((key) => !isFileStorageKey(key))
  ) {
    throw new Error("Invalid attachment references.");
  }
  const files = await db
    .select({ key: eveStoredFile.key })
    .from(eveStoredFile)
    .where(
      and(
        eq(eveStoredFile.ownerId, ownerId),
        eq(eveStoredFile.state, "active"),
        inArray(eveStoredFile.key, uniqueKeys)
      )
    );
  if (files.length !== uniqueKeys.length) {
    throw new Error("Attachment is not owned by this user.");
  }
}

/** Persist the key before storage I/O so a failed upload remains discoverable. */
export async function reserveEveGeneratedFile(
  ownerId: string,
  conversationId: string,
  key: string
) {
  if (!isFileStorageKey(key)) {
    throw new Error("Invalid storage key.");
  }
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [conversation] = await tx
      .select({ id: eveConversation.id })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.state, "bound")
        )
      );
    if (!conversation) {
      throw new Error("Conversation is unavailable for generated files.");
    }
    await tx.insert(eveStoredFile).values({ key, ownerId });
    await tx.insert(eveFileReference).values({ key, ownerId, conversationId });
  });
}

/** Deletion cannot pass an admitted write; the committed reservation survives failures. */
export async function writeEveGeneratedFile<T>(
  ownerId: string,
  conversationId: string,
  key: string,
  write: () => Promise<T>
) {
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [reference] = await tx
      .select({ key: eveFileReference.key })
      .from(eveFileReference)
      .innerJoin(eveStoredFile, eq(eveStoredFile.key, eveFileReference.key))
      .innerJoin(
        eveConversation,
        eq(eveConversation.id, eveFileReference.conversationId)
      )
      .where(
        and(
          eq(eveFileReference.key, key),
          eq(eveStoredFile.state, "active"),
          eq(eveFileReference.conversationId, conversationId),
          eq(eveFileReference.ownerId, ownerId),
          eq(eveConversation.state, "bound")
        )
      );
    if (!reference) {
      throw new Error("Conversation is unavailable for generated files.");
    }
    return await write();
  });
}

/** Caller holds the owner family lock and has authorized the document revision. */
export async function retainEveDocumentFiles(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerId: string,
  conversationId: string,
  content: string
) {
  // Stored URLs are canonical paths with one ASCII key. Match conservatively:
  // retaining a file mentioned as text is preferable to deleting a referenced image.
  const candidates = [
    ...new Set(
      [...content.matchAll(DOCUMENT_FILE_URL)].map((match) => match[1])
    ),
  ];
  if (!candidates.length) {
    return;
  }
  const files = await tx
    .select({ key: eveStoredFile.key })
    .from(eveStoredFile)
    .where(
      and(
        eq(eveStoredFile.ownerId, ownerId),
        eq(eveStoredFile.state, "active"),
        inArray(eveStoredFile.key, candidates)
      )
    );
  if (files.length) {
    await tx
      .insert(eveFileReference)
      .values(files.map(({ key }) => ({ key, ownerId, conversationId })))
      .onConflictDoNothing();
  }
}
