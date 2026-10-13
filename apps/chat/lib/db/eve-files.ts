import { and, eq, inArray, sql } from "drizzle-orm";

import { isFileStorageKey } from "@/lib/file-url";

import { db } from "./client";
import { eveConversation, eveFileReference, eveStoredFile } from "./schema";

const FIRST_ROW_INDEX = 0;
const SINGLE_ROW_LIMIT = 1;
const MAXIMUM_ATTACHMENT_REFERENCES = 16;

// Native capabilities used by locked storage writes and reservations.
type FileTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type FileLockTransaction = Readonly<
  Pick<FileTransaction, "execute" | "select">
>;
type FileWriteTransaction = Readonly<
  Pick<FileTransaction, "execute" | "insert" | "select">
>;

/**
 * Legacy keys have no EVE row; only EVE deletion fences deny an existing URL.
 * @param {string} key - Storage key whose durable deletion fence is checked.
 * @returns {Promise<boolean>} Whether an existing managed file is no longer active.
 */
const isEveFileUnavailable = async (key: string): Promise<boolean> => {
  const [file] = await db
    .select({ state: eveStoredFile.state })
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, key));
  return file !== undefined && file.state !== "active";
};

/**
 * Recheck durable access on every download, including URLs disclosed by old shares.
 * @param {string} key - Storage key requested by the download.
 * @param {string | undefined} ownerId - Signed-in owner, when the request is authenticated.
 * @returns {Promise<{ allowed: boolean; managed: boolean }>} Access decision and whether the key is managed by EVE.
 */
const canReadEveFile = async (
  key: string,
  ownerId?: string
): Promise<{ allowed: boolean; managed: boolean }> => {
  const fileRows = await db
    .select()
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, key));
  const file = fileRows.at(FIRST_ROW_INDEX);
  if (!file) {
    return { allowed: true, managed: false };
  }
  if (file.state !== "active") {
    return { allowed: false, managed: true };
  }
  if (file.ownerId === ownerId) {
    return { allowed: true, managed: true };
  }
  const [reference] = await db
    .select({ key: eveFileReference.key })
    .from(eveFileReference)
    .innerJoin(
      eveConversation,
      eq(eveConversation.id, eveFileReference.conversationId)
    )
    .where(
      and(
        eq(eveFileReference.key, key),
        eq(eveConversation.state, "bound"),
        sql`(${eveConversation.ownerId} = ${ownerId ?? null} or ${eveConversation.visibility} = 'public')`
      )
    )
    .limit(SINGLE_ROW_LIMIT);
  return { allowed: Boolean(reference), managed: true };
};

/**
 * Reserve a fresh upload before storage I/O; never overwrite an existing key.
 * @param {string} ownerId - Owner to bind to the new upload.
 * @param {string} key - Fresh validated storage key to reserve.
 */
const reserveEveUpload = async (
  ownerId: string,
  key: string
): Promise<void> => {
  if (!(ownerId && isFileStorageKey(key))) {
    throw new Error("Invalid upload ownership reservation.");
  }
  await db.insert(eveStoredFile).values({ key, ownerId });
};

/**
 * Serialize admitted storage writes with orphan cleanup and reference creation.
 * @param {string} ownerId - Owner whose family lock protects the write.
 * @param {string} key - Active upload reservation to recheck under the lock.
 * @param {() => Promise<Result>} write - Storage operation admitted after ownership validation.
 * @returns {Promise<Result>} The storage operation result after the transaction completes.
 */
const writeEveUpload = async <Result>(
  ownerId: string,
  key: string,
  write: () => Promise<Result>
): Promise<Result> =>
  await db.transaction(async (tx: FileLockTransaction) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const fileRows = await tx
      .select({ key: eveStoredFile.key })
      .from(eveStoredFile)
      .where(
        and(
          eq(eveStoredFile.key, key),
          eq(eveStoredFile.ownerId, ownerId),
          eq(eveStoredFile.state, "active")
        )
      );
    const file = fileRows.at(FIRST_ROW_INDEX);
    if (!file) {
      throw new Error("Upload reservation is unavailable.");
    }
    return await write();
  });

/**
 * Register server-created keys only; a caller-supplied URL is not ownership proof.
 * @param {string} ownerId - Owner that must match any existing active file row.
 * @param {string} key - Server-created storage key to register.
 */
const registerEveStoredFile = async (
  ownerId: string,
  key: string
): Promise<void> => {
  if (!(ownerId && isFileStorageKey(key))) {
    throw new Error("Invalid file ownership registration.");
  }
  await db.insert(eveStoredFile).values({ key, ownerId }).onConflictDoNothing();
  const savedRows = await db
    .select({ ownerId: eveStoredFile.ownerId, state: eveStoredFile.state })
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, key));
  const saved = savedRows.at(FIRST_ROW_INDEX);
  if (!saved || saved.ownerId !== ownerId || saved.state !== "active") {
    throw new Error("File ownership cannot be reassigned.");
  }
};
/**
 * Claim before dispatch; failed/uncertain sends retain their references safely.
 * @param {string} ownerId - Owner of the conversation and every attachment.
 * @param {string} conversationId - Conversation that receives durable attachment references.
 * @param {readonly string[]} keys - Storage keys to validate and retain before dispatch.
 */
const referenceEveFiles = async (
  ownerId: string,
  conversationId: string,
  keys: readonly string[]
): Promise<void> => {
  const uniqueKeys = [...new Set(keys)].toSorted();
  if (uniqueKeys.length === 0) {
    return;
  }
  if (
    uniqueKeys.length > MAXIMUM_ATTACHMENT_REFERENCES ||
    uniqueKeys.some((key) => !isFileStorageKey(key))
  ) {
    throw new Error("Invalid attachment references.");
  }
  await db.transaction(async (tx: FileWriteTransaction) => {
    // Serializes with deletion and fork reservation, before observing state.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const conversationRows = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId)
        )
      );
    const conversation = conversationRows.at(FIRST_ROW_INDEX);
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
      .values(uniqueKeys.map((key) => ({ conversationId, key, ownerId })))
      .onConflictDoNothing();
  });
};

/**
 * Preflight rejects invalid initial input before a creation reservation exists.
 * @param {string} ownerId - Owner required for every active attachment.
 * @param {readonly string[]} keys - Initial attachment storage keys to validate.
 */
const assertEveFilesOwned = async (
  ownerId: string,
  keys: readonly string[]
): Promise<void> => {
  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) {
    return;
  }
  if (
    uniqueKeys.length > MAXIMUM_ATTACHMENT_REFERENCES ||
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
};

/**
 * Persist the key before storage I/O so a failed upload remains discoverable.
 * @param {string} ownerId - Owner of the bound conversation and generated file.
 * @param {string} conversationId - Bound conversation that retains the generated file.
 * @param {string} key - Fresh storage key reserved before the upload.
 */
const reserveEveGeneratedFile = async (
  ownerId: string,
  conversationId: string,
  key: string
): Promise<void> => {
  if (!isFileStorageKey(key)) {
    throw new Error("Invalid storage key.");
  }
  await db.transaction(async (tx: FileWriteTransaction) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const conversationRows = await tx
      .select({ id: eveConversation.id })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.state, "bound")
        )
      );
    const conversation = conversationRows.at(FIRST_ROW_INDEX);
    if (!conversation) {
      throw new Error("Conversation is unavailable for generated files.");
    }
    await tx.insert(eveStoredFile).values({ key, ownerId });
    await tx.insert(eveFileReference).values({ conversationId, key, ownerId });
  });
};

/**
 * Deletion cannot pass an admitted write; the committed reservation survives failures.
 * @param {string} ownerId - Owner whose family lock protects the generated write.
 * @param {string} conversationId - Bound conversation whose file reference is rechecked.
 * @param {string} key - Active generated-file reservation to validate.
 * @param {() => Promise<Result>} write - Storage operation admitted while the deletion fence is locked.
 * @returns {Promise<Result>} The storage operation result after the transaction completes.
 */
const writeEveGeneratedFile = async <Result>(
  ownerId: string,
  conversationId: string,
  key: string,
  write: () => Promise<Result>
): Promise<Result> =>
  await db.transaction(async (tx: FileLockTransaction) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const referenceRows = await tx
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
    const reference = referenceRows.at(FIRST_ROW_INDEX);
    if (!reference) {
      throw new Error("Conversation is unavailable for generated files.");
    }
    return await write();
  });

export {
  assertEveFilesOwned,
  canReadEveFile,
  isEveFileUnavailable,
  referenceEveFiles,
  registerEveStoredFile,
  reserveEveGeneratedFile,
  reserveEveUpload,
  writeEveGeneratedFile,
  writeEveUpload,
};
