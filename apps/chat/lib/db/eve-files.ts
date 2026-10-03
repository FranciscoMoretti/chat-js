/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../file-url" dependency within this package instead of introducing an alias or barrel API.
 */
import { and, eq, inArray, sql } from "drizzle-orm";

import { isFileStorageKey } from "../file-url";
import { db } from "./client";
import { eveConversation, eveFileReference, eveStoredFile } from "./schema";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-undefined --
 * import/group-exports (#523): isEveFileUnavailable stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): isEveFileUnavailable's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): isEveFileUnavailable's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-undefined (#519): isEveFileUnavailable uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
/** Legacy keys have no EVE row; only EVE deletion fences deny an existing URL. */
export const isEveFileUnavailable = async (key: string): Promise<boolean> => {
  const [file] = await db
    .select({ state: eveStoredFile.state })
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, key));
  return file !== undefined && file.state !== "active";
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-undefined */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * import/group-exports (#523): canReadEveFile stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): canReadEveFile's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): canReadEveFile's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): canReadEveFile uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep canReadEveFile's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep canReadEveFile's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): canReadEveFile intentionally keeps the existing falsy-value behavior of file; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): canReadEveFile preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** Recheck durable access on every download, including URLs disclosed by old shares. */
export const canReadEveFile = async (key: string, ownerId?: string) => {
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
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable import/group-exports, jsdoc/require-param --
 * import/group-exports (#523): reserveEveUpload stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): reserveEveUpload's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 */
/** Reserve a fresh upload before storage I/O; never overwrite an existing key. */
export const reserveEveUpload = async (
  ownerId: string,
  key: string
): Promise<void> => {
  if (!(ownerId && isFileStorageKey(key))) {
    throw new Error("Invalid upload ownership reservation.");
  }
  await db.insert(eveStoredFile).values({ key, ownerId });
};
/* oxlint-enable import/group-exports, jsdoc/require-param */

/* oxlint-disable id-length, import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * id-length (#506): writeEveUpload uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): writeEveUpload stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): writeEveUpload's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): writeEveUpload's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/explicit-function-return-type (#560): Keep writeEveUpload's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep writeEveUpload's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): writeEveUpload accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): writeEveUpload intentionally keeps the existing falsy-value behavior of file; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Serialize admitted storage writes with orphan cleanup and reference creation. */
export const writeEveUpload = async <T>(
  ownerId: string,
  key: string,
  write: () => Promise<T>
) =>
  await db.transaction(async (tx) => {
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
/* oxlint-enable id-length, import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, jsdoc/require-param --
 * import/group-exports (#523): registerEveStoredFile stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): registerEveStoredFile's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 */
/** Register server-created keys only; a caller-supplied URL is not ownership proof. */
export const registerEveStoredFile = async (
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
/* oxlint-enable import/group-exports, jsdoc/require-param */

/* oxlint-disable import/group-exports, jsdoc/require-param, max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): referenceEveFiles stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): referenceEveFiles's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): referenceEveFiles keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): referenceEveFiles uses 0, 16 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): referenceEveFiles accepts keys: string[]; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): referenceEveFiles intentionally keeps the existing falsy-value behavior of conversation; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Claim before dispatch; failed/uncertain sends retain their references safely. */
export const referenceEveFiles = async (
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
      .values(uniqueKeys.map((key) => ({ conversationId, key, ownerId })))
      .onConflictDoNothing();
  });
};
/* oxlint-enable import/group-exports, jsdoc/require-param, max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, jsdoc/require-param, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): assertEveFilesOwned stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): assertEveFilesOwned's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): assertEveFilesOwned uses 0, 16 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): assertEveFilesOwned accepts keys: string[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Preflight rejects invalid initial input before a creation reservation exists. */
export const assertEveFilesOwned = async (
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
/* oxlint-enable import/group-exports, jsdoc/require-param, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, jsdoc/require-param, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): reserveEveGeneratedFile stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): reserveEveGeneratedFile's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/prefer-readonly-parameter-types (#565): reserveEveGeneratedFile accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): reserveEveGeneratedFile intentionally keeps the existing falsy-value behavior of conversation; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Persist the key before storage I/O so a failed upload remains discoverable. */
export const reserveEveGeneratedFile = async (
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
    await tx.insert(eveFileReference).values({ conversationId, key, ownerId });
  });
};
/* oxlint-enable import/group-exports, jsdoc/require-param, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable id-length, import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-params, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * id-length (#506): writeEveGeneratedFile uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): writeEveGeneratedFile stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): writeEveGeneratedFile's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): writeEveGeneratedFile's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-params (#511): writeEveGeneratedFile keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep writeEveGeneratedFile's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep writeEveGeneratedFile's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): writeEveGeneratedFile accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): writeEveGeneratedFile intentionally keeps the existing falsy-value behavior of reference; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Deletion cannot pass an admitted write; the committed reservation survives failures. */
export const writeEveGeneratedFile = async <T>(
  ownerId: string,
  conversationId: string,
  key: string,
  write: () => Promise<T>
) =>
  await db.transaction(async (tx) => {
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
/* oxlint-enable id-length, import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-params, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, jsdoc/require-param, max-params, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): retainEveDocumentFiles stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): retainEveDocumentFiles's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-params (#511): retainEveDocumentFiles keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): retainEveDocumentFiles uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): retainEveDocumentFiles accepts tx: Parameters<Parameters<typeof db.transaction>[0]>[0]; fileIds: string[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Caller holds the owner family lock and has authorized the document revision. */
export const retainEveDocumentFiles = async (
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
  if (files.length > 0) {
    await tx
      .insert(eveFileReference)
      .values(files.map(({ key }) => ({ conversationId, key, ownerId })))
      .onConflictDoNothing();
  }
};
/* oxlint-enable import/group-exports, jsdoc/require-param, max-params, no-magic-numbers, typescript/prefer-readonly-parameter-types */
