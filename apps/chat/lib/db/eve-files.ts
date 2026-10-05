import { and, eq, inArray, sql } from "drizzle-orm";

import { isFileStorageKey } from "@/lib/file-url";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "./client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, eveFileReference, eveStoredFile } from "./schema";
/* oxlint-enable sort-imports */

const FIRST_ROW_INDEX = 0;

/* oxlint-disable no-undefined -- no-undefined (#519): isEveFileUnavailable uses undefined for absent or optional values; substituting null would alter its type and serialization contract. */
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
/* oxlint-enable no-undefined */

/* oxlint-disable no-magic-numbers, unicorn/no-null, typescript/strict-boolean-expressions -- no-magic-numbers (#517): canReadEveFile uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
unicorn/no-null (#570): canReadEveFile preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
typescript/strict-boolean-expressions (#610): canReadEveFile intentionally keeps the existing falsy-value behavior of file; distinguishing empty, zero, and absent states requires a domain behavior decision. */
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
  const [file] = await db
    .select()
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, key));
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
    .limit(1);
  return { allowed: Boolean(reference), managed: true };
};
/* oxlint-enable no-magic-numbers, unicorn/no-null, typescript/strict-boolean-expressions */

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

/* oxlint-disable id-length, typescript/prefer-readonly-parameter-types -- id-length (#506): writeEveUpload uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
typescript/prefer-readonly-parameter-types (#565): writeEveUpload accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * Serialize admitted storage writes with orphan cleanup and reference creation.
 * @param {string} ownerId - Owner whose family lock protects the write.
 * @param {string} key - Active upload reservation to recheck under the lock.
 * @param {() => Promise<T>} write - Storage operation admitted after ownership validation.
 * @returns {Promise<T>} The storage operation result after the transaction completes.
 */
const writeEveUpload = async <T>(
  ownerId: string,
  key: string,
  write: () => Promise<T>
): Promise<T> =>
  await db.transaction(async (tx) => {
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
/* oxlint-enable id-length, typescript/prefer-readonly-parameter-types */

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
  const [saved] = await db
    .select({ ownerId: eveStoredFile.ownerId, state: eveStoredFile.state })
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, key));
  if (saved?.ownerId !== ownerId || saved.state !== "active") {
    throw new Error("File ownership cannot be reassigned.");
  }
};

/* oxlint-disable max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types -- max-lines-per-function (#510): referenceEveFiles keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): referenceEveFiles uses 0, 16 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): referenceEveFiles accepts keys: string[]; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * Claim before dispatch; failed/uncertain sends retain their references safely.
 * @param {string} ownerId - Owner of the conversation and every attachment.
 * @param {string} conversationId - Conversation that receives durable attachment references.
 * @param {string[]} keys - Storage keys to validate and retain before dispatch.
 */
const referenceEveFiles = async (
  ownerId: string,
  conversationId: string,
  keys: string[]
): Promise<void> => {
  const uniqueKeys = [...new Set(keys)].toSorted();
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
/* oxlint-enable max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types -- no-magic-numbers (#517): assertEveFilesOwned uses 0, 16 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): assertEveFilesOwned accepts keys: string[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * Preflight rejects invalid initial input before a creation reservation exists.
 * @param {string} ownerId - Owner required for every active attachment.
 * @param {string[]} keys - Initial attachment storage keys to validate.
 */
const assertEveFilesOwned = async (
  ownerId: string,
  keys: string[]
): Promise<void> => {
  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) {
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
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): reserveEveGeneratedFile accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
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
  await db.transaction(async (tx) => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable id-length, max-params, typescript/prefer-readonly-parameter-types -- id-length (#506): writeEveGeneratedFile uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
max-params (#511): writeEveGeneratedFile keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): writeEveGeneratedFile accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * Deletion cannot pass an admitted write; the committed reservation survives failures.
 * @param {string} ownerId - Owner whose family lock protects the generated write.
 * @param {string} conversationId - Bound conversation whose file reference is rechecked.
 * @param {string} key - Active generated-file reservation to validate.
 * @param {() => Promise<T>} write - Storage operation admitted while the deletion fence is locked.
 * @returns {Promise<T>} The storage operation result after the transaction completes.
 */
const writeEveGeneratedFile = async <T>(
  ownerId: string,
  conversationId: string,
  key: string,
  write: () => Promise<T>
): Promise<T> =>
  await db.transaction(async (tx) => {
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
/* oxlint-enable id-length, max-params, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-params, no-magic-numbers, typescript/prefer-readonly-parameter-types -- max-params (#511): retainEveDocumentFiles keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): retainEveDocumentFiles uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): retainEveDocumentFiles accepts tx: Parameters<Parameters<typeof db.transaction>[0]>[0]; fileIds: string[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * Caller holds the owner family lock and has authorized the document revision.
 * @param {Parameters<Parameters<typeof db.transaction>[0]>[0]} tx - Caller transaction holding the owner family lock.
 * @param {string} ownerId - Owner required for every active document file.
 * @param {string} conversationId - Conversation that retains the document references.
 * @param {string[]} fileIds - Storage keys referenced by the authorized revision.
 */
const retainEveDocumentFiles = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerId: string,
  conversationId: string,
  fileIds: string[]
): Promise<void> => {
  const candidates = [...new Set(fileIds)];
  if (candidates.some((id) => !isFileStorageKey(id))) {
    throw new Error("Invalid document file reference.");
  }
  if (candidates.length === 0) {
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
  if (files.length !== candidates.length) {
    throw new Error("Document references an unavailable or unowned file.");
  }
  await tx
    .insert(eveFileReference)
    .values(files.map(({ key }) => ({ conversationId, key, ownerId })))
    .onConflictDoNothing();
};
/* oxlint-enable max-params, no-magic-numbers, typescript/prefer-readonly-parameter-types */
export {
  assertEveFilesOwned,
  canReadEveFile,
  isEveFileUnavailable,
  referenceEveFiles,
  registerEveStoredFile,
  reserveEveGeneratedFile,
  reserveEveUpload,
  retainEveDocumentFiles,
  writeEveGeneratedFile,
  writeEveUpload,
};
