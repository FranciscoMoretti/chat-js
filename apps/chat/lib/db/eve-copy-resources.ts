/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "./client";
import {
  assertEveCopySourceAvailable,
  EveCopySourceChangedError,
  lockEveCopyOwners,
  readEveCopy,
} from "./eve-copy-journal";
import { CreationConflictError } from "./eve-queries";
import {
  eveConversationCopy,
  eveConversationCopyFile,
  eveDocumentHead,
  eveDocumentRevision,
  eveFileReference,
  eveImportedDocumentCheckpoint,
  eveImportedDocumentCheckpointEntry,
  eveStoredFile,
} from "./schema";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- jsdoc/require-param (#534): writeEveCopyFile's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): writeEveCopyFile's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-lines-per-function (#510): writeEveCopyFile keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-params (#511): writeEveCopyFile keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): writeEveCopyFile keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/explicit-function-return-type (#560): Keep writeEveCopyFile's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep writeEveCopyFile's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): writeEveCopyFile accepts storage: { readSourceFile: ( key: string ) => Promise<Pick<Blob, "type" | "arrayBuffe; file: Blob; tx; candidate; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): writeEveCopyFile intentionally keeps the existing falsy-value behavior of receipt; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/** The family lock fences writes against rejection/deletion, including an uncertain storage reply. */
const writeEveCopyFile = async (
  ownerId: string,
  conversationId: string,
  key: string,
  storage: {
    readSourceFile: (
      key: string
    ) => Promise<Pick<Blob, "type" | "arrayBuffer">>;
    writeDestinationFile: (key: string, file: Blob) => Promise<void>;
  }
) => {
  const initial = await readEveCopy(db, ownerId, conversationId);
  return await db.transaction(async (tx) => {
    await lockEveCopyOwners(tx, [ownerId, initial.copy.sourceOwnerId]);
    const { copy, conversation } = await readEveCopy(
      tx,
      ownerId,
      conversationId
    );
    if (
      copy.phase === "rejected" ||
      ["deleting", "deleted"].includes(conversation.state)
    ) {
      throw new CreationConflictError("Saved copy is unavailable.");
    }
    const [receipt] = await tx
      .select()
      .from(eveConversationCopyFile)
      .where(
        and(
          eq(eveConversationCopyFile.conversationId, conversationId),
          eq(eveConversationCopyFile.ownerId, ownerId),
          eq(eveConversationCopyFile.key, key)
        )
      );
    if (!receipt) {
      throw new Error("Copied file was not allocated.");
    }
    if (receipt.writtenAt) {
      return receipt;
    }
    const file = copy.plan?.files.find((candidate) => candidate.key === key);
    if (copy.phase !== "preparing" || !file) {
      throw new Error("Saved copy preparation is unavailable.");
    }
    await assertEveCopySourceAvailable(tx, copy);
    const blob =
      file.source.kind === "inline"
        ? new Blob([Buffer.from(file.source.base64, "base64")], {
            type: file.mediaType,
          })
        : await storage.readSourceFile(file.source.key);
    const bytes = Buffer.from(await blob.arrayBuffer());
    if (
      blob.type !== receipt.mediaType ||
      bytes.length !== receipt.size ||
      createHash("sha256").update(bytes).digest("hex") !== receipt.sha256
    ) {
      throw new EveCopySourceChangedError(
        "Copy source file changed after preparation."
      );
    }
    await storage.writeDestinationFile(
      key,
      new Blob([bytes], { type: receipt.mediaType })
    );
    const [written] = await tx
      .update(eveConversationCopyFile)
      .set({ writtenAt: new Date() })
      .where(
        and(
          eq(eveConversationCopyFile.conversationId, conversationId),
          eq(eveConversationCopyFile.key, key)
        )
      )
      .returning();
    return written;
  });
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable jsdoc/require-param, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null -- jsdoc/require-param (#534): writeEveCopyDocuments's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-lines-per-function (#510): writeEveCopyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): writeEveCopyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): writeEveCopyDocuments uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): writeEveCopyDocuments accepts tx; document; revision; checkpoint; head; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/no-null (#570): writeEveCopyDocuments preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/** All ancestry and heads commit together, before any copy can be accepted. */
const writeEveCopyDocuments = async (
  ownerId: string,
  conversationId: string
): Promise<void> => {
  await db.transaction(async (tx) => {
    await lockEveCopyOwners(tx, [ownerId]);
    const { copy, conversation } = await readEveCopy(
      tx,
      ownerId,
      conversationId
    );
    if (
      copy.phase === "rejected" ||
      ["deleting", "deleted"].includes(conversation.state)
    ) {
      throw new CreationConflictError("Saved copy is unavailable.");
    }
    if (copy.documentsReady) {
      return;
    }
    if (copy.phase !== "preparing" || !copy.plan) {
      throw new Error("Saved copy preparation is unavailable.");
    }
    const revisions = copy.plan.documents.flatMap((document) =>
      document.revisions.map((revision) => ({
        ...revision,
        conversationId,
        createdAt: new Date(revision.createdAt),
        documentId: document.documentId,
        operationId: `copy:${revision.id}`,
        ownerId,
        turnIndex: null,
      }))
    );
    if (revisions.length > 0) {
      await tx.insert(eveDocumentRevision).values(revisions);
    }
    if (copy.plan.documents.length > 0) {
      await tx.insert(eveDocumentHead).values(
        copy.plan.documents.map((document) => ({
          conversationId,
          documentId: document.documentId,
          ownerId,
          revisionId: document.headRevisionId,
        }))
      );
    }
    if (copy.plan.documentCheckpoints.length > 0) {
      await tx.insert(eveImportedDocumentCheckpoint).values(
        copy.plan.documentCheckpoints.map((checkpoint) => ({
          conversationId,
          messageIndex: checkpoint.messageIndex,
          ownerId,
        }))
      );
      const entries = copy.plan.documentCheckpoints.flatMap((checkpoint) =>
        checkpoint.heads.map((head) => ({
          conversationId,
          messageIndex: checkpoint.messageIndex,
          ownerId,
          ...head,
        }))
      );
      if (entries.length > 0) {
        await tx.insert(eveImportedDocumentCheckpointEntry).values(entries);
      }
    }
    await tx
      .update(eveConversationCopy)
      .set({ documentsReady: true })
      .where(eq(eveConversationCopy.conversationId, conversationId));
  });
};
/* oxlint-enable jsdoc/require-param, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls, unicorn/no-null -- jsdoc/require-param (#534): acceptEveCopy's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): acceptEveCopy's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-lines-per-function (#510): acceptEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): acceptEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): acceptEveCopy uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/explicit-function-return-type (#560): Keep acceptEveCopy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep acceptEveCopy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): acceptEveCopy accepts tx; head; expected; receipt; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/max-nested-calls (#568): acceptEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
unicorn/no-null (#570): acceptEveCopy preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/** This short transaction is the publication boundary; no native or storage I/O runs inside it. */
const acceptEveCopy = async (ownerId: string, conversationId: string) => {
  const initial = await readEveCopy(db, ownerId, conversationId);
  return await db.transaction(async (tx) => {
    await lockEveCopyOwners(tx, [ownerId, initial.copy.sourceOwnerId]);
    const { copy, conversation } = await readEveCopy(
      tx,
      ownerId,
      conversationId
    );
    if (
      copy.phase === "rejected" ||
      ["deleting", "deleted"].includes(conversation.state)
    ) {
      throw new CreationConflictError("Saved copy is unavailable.");
    }
    if (copy.phase === "accepted" || copy.phase === "bound") {
      return copy.phase;
    }
    if (!(copy.plan && copy.documentsReady)) {
      throw new Error("Copied documents are not committed.");
    }
    await assertEveCopySourceAvailable(tx, copy);
    const heads =
      copy.plan.sourceHeads.length > 0
        ? await tx
            .select({
              documentId: eveDocumentHead.documentId,
              revisionId: eveDocumentHead.revisionId,
            })
            .from(eveDocumentHead)
            .where(
              and(
                eq(eveDocumentHead.conversationId, copy.sourceConversationId),
                eq(eveDocumentHead.ownerId, copy.sourceOwnerId),
                inArray(
                  eveDocumentHead.documentId,
                  copy.plan.sourceHeads.map((head) => head.documentId)
                )
              )
            )
        : [];
    if (
      heads.length !== copy.plan.sourceHeads.length ||
      copy.plan.sourceHeads.some(
        (expected) =>
          !heads.some(
            (head) =>
              head.documentId === expected.documentId &&
              head.revisionId === expected.revisionId
          )
      )
    ) {
      throw new EveCopySourceChangedError(
        "Published document history changed before the copy was accepted."
      );
    }
    const receipts = await tx
      .select({
        key: eveConversationCopyFile.key,
        writtenAt: eveConversationCopyFile.writtenAt,
      })
      .from(eveConversationCopyFile)
      .innerJoin(
        eveStoredFile,
        and(
          eq(eveStoredFile.key, eveConversationCopyFile.key),
          eq(eveStoredFile.ownerId, ownerId),
          eq(eveStoredFile.state, "active")
        )
      )
      .innerJoin(
        eveFileReference,
        and(
          eq(eveFileReference.key, eveConversationCopyFile.key),
          eq(eveFileReference.conversationId, conversationId),
          eq(eveFileReference.ownerId, ownerId)
        )
      )
      .where(
        and(
          eq(eveConversationCopyFile.conversationId, conversationId),
          eq(eveConversationCopyFile.ownerId, ownerId)
        )
      );
    if (
      receipts.length !== copy.plan.files.length ||
      receipts.some((receipt) => !receipt.writtenAt)
    ) {
      throw new Error("Copied file writes are not committed.");
    }
    await tx
      .update(eveConversationCopy)
      .set({
        acceptedAt: new Date(),
        phase: "accepted",
        plan: null,
        seed: copy.plan.seed,
      })
      .where(eq(eveConversationCopy.conversationId, conversationId));
    return "accepted";
  });
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls, unicorn/no-null */
export { acceptEveCopy, writeEveCopyDocuments, writeEveCopyFile };
