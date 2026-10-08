/* oxlint-disable max-lines -- File writes, document writes and acceptance share one saved-copy lifecycle; their transaction sequencing remains in this module. */
/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { createHash } from "node:crypto";

import { db } from "./client";
/* oxlint-disable sort-imports -- Keep eve-copy-journal evaluation after direct client initialization; the journal imports client, eve-queries, schema and copy-transcript. */
import {
  EveCopySourceChangedError,
  assertEveCopySourceAvailable,
  lockEveCopyOwners,
  readEveCopy,
} from "./eve-copy-journal";
/* oxlint-enable sort-imports */
import { CreationConflictError } from "./eve-queries";
/* oxlint-disable sort-imports -- Keep direct schema import after the journal and eve-queries imports; schema builds pgTable objects at module load. */
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
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

const FIRST_ROW_INDEX = 0;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve writeEveCopyFile's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-params, max-statements --
max-lines-per-function (#510): writeEveCopyFile keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-params (#511): writeEveCopyFile keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): writeEveCopyFile keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
/**
 * The family lock fences writes against rejection/deletion, including an uncertain storage reply.
 * @param {string} ownerId Owner of the allocated destination copy.
 * @param {string} conversationId Destination conversation whose file inventory is already allocated.
 * @param {string} key Allocated destination file key to verify and write.
 * @param {{ readSourceFile: ( key: string ) => Promise<Pick<Blob, "type" | "arrayBuffer">>; writeDestinationFile: (key: string, file: Blob) => Promise<void>; }} storage Source reader and destination writer used while the copy family is locked.
 * @param {( key: string ) => Promise<Pick<Blob, "type" | "arrayBuffer">>} storage.readSourceFile Read the source bytes and content type for an allocated file.
 * @param {(key: string, file: Blob) => Promise<void>} storage.writeDestinationFile Acknowledge the destination write before recording its receipt.
 * @returns {Promise<typeof eveConversationCopyFile.$inferSelect>} The allocated receipt, with writtenAt recorded after content type, size, and digest verification.
 */
const writeEveCopyFile = async (
  ownerId: string,
  conversationId: string,
  key: string,
  storage: {
    readonly readSourceFile: (
      key: string
    ) => Promise<Pick<Blob, "type" | "arrayBuffer">>;
    readonly writeDestinationFile: (
      key: string,
      file: ReadonlyNativeSurface<Blob>
    ) => Promise<void>;
  }
): Promise<typeof eveConversationCopyFile.$inferSelect> => {
  const initial = await readEveCopy(db, ownerId, conversationId);
  return await db.transaction(
    async (tx: Readonly<Pick<typeof db, "execute" | "select" | "update">>) => {
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
      const receiptRows = await tx
        .select()
        .from(eveConversationCopyFile)
        .where(
          and(
            eq(eveConversationCopyFile.conversationId, conversationId),
            eq(eveConversationCopyFile.ownerId, ownerId),
            eq(eveConversationCopyFile.key, key)
          )
        );
      const receipt = receiptRows.at(FIRST_ROW_INDEX);
      if (!receipt) {
        throw new Error("Copied file was not allocated.");
      }
      if (receipt.writtenAt) {
        return receipt;
      }
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading files from copy.plan; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      const file = copy.plan?.files.find(
        (candidate: { readonly key: string }) => candidate.key === key
      );
      if (copy.phase !== "preparing" || !file) {
        throw new Error("Saved copy preparation is unavailable.");
      }
      await assertEveCopySourceAvailable(tx, copy);
      const blob =
        // oxlint-disable-next-line no-ternary -- Keep blob as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
    }
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve writeEveCopyDocuments's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-params, max-statements */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, unicorn/no-null --
max-lines-per-function (#510): writeEveCopyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): writeEveCopyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): writeEveCopyDocuments uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.

unicorn/no-null (#570): writeEveCopyDocuments preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/**
 * All ancestry and heads commit together, before any copy can be accepted.
 * @param {string} ownerId Owner whose copy family lock authorizes the destination writes.
 * @param {string} conversationId Allocated copy receiving revision ancestry, checkpoint entries, and document heads atomically.
 */
const writeEveCopyDocuments = async (
  ownerId: string,
  conversationId: string
): Promise<void> => {
  await db.transaction(
    async (
      tx: Readonly<Pick<typeof db, "execute" | "insert" | "select" | "update">>
    ) => {
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
      const revisions = copy.plan.documents.flatMap(
        (
          document: ReadonlyNativeSurface<
            NonNullable<typeof copy.plan>["documents"][number]
          >
        ) =>
          document.revisions.map(
            (
              revision: ReadonlyNativeSurface<
                (typeof document.revisions)[number]
              >
            ) => ({
              // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing revision own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
              ...revision,
              conversationId,
              createdAt: new Date(revision.createdAt),
              documentId: document.documentId,
              operationId: `copy:${revision.id}`,
              ownerId,
              turnIndex: null,
            })
          )
      );
      if (revisions.length > 0) {
        await tx.insert(eveDocumentRevision).values(revisions);
      }
      if (copy.plan.documents.length > 0) {
        await tx.insert(eveDocumentHead).values(
          copy.plan.documents.map(
            (document: {
              readonly documentId: string;
              readonly headRevisionId: string;
            }) => ({
              conversationId,
              documentId: document.documentId,
              ownerId,
              revisionId: document.headRevisionId,
            })
          )
        );
      }
      if (copy.plan.documentCheckpoints.length > 0) {
        await tx.insert(eveImportedDocumentCheckpoint).values(
          copy.plan.documentCheckpoints.map(
            (checkpoint: { readonly messageIndex: number }) => ({
              conversationId,
              messageIndex: checkpoint.messageIndex,
              ownerId,
            })
          )
        );
        const entries = copy.plan.documentCheckpoints.flatMap(
          (checkpoint: {
            readonly messageIndex: number;
            readonly heads: readonly {
              readonly documentId: string;
              readonly revisionId: string;
            }[];
          }) =>
            checkpoint.heads.map(
              (head: Readonly<{ documentId: string; revisionId: string }>) => ({
                conversationId,
                messageIndex: checkpoint.messageIndex,
                ownerId,
                // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing head own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
                ...head,
              })
            )
        );
        if (entries.length > 0) {
          await tx.insert(eveImportedDocumentCheckpointEntry).values(entries);
        }
      }
      await tx
        .update(eveConversationCopy)
        .set({ documentsReady: true })
        .where(eq(eveConversationCopy.conversationId, conversationId));
    }
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve acceptEveCopy's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, unicorn/max-nested-calls, unicorn/no-null --
max-lines-per-function (#510): acceptEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): acceptEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): acceptEveCopy uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.

unicorn/max-nested-calls (#568): acceptEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
unicorn/no-null (#570): acceptEveCopy preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/**
 * This short transaction is the publication boundary; no native or storage I/O runs inside it.
 * @param {string} ownerId Owner whose copy and source family are locked for publication.
 * @param {string} conversationId Copy whose file receipts, committed documents, and current source heads must match its plan.
 * @returns {Promise<"accepted" | "bound">} The accepted phase, or the existing bound phase for an idempotent publication replay.
 */
const acceptEveCopy = async (
  ownerId: string,
  conversationId: string
): Promise<"accepted" | "bound"> => {
  const initial = await readEveCopy(db, ownerId, conversationId);
  return await db.transaction(
    async (tx: Readonly<Pick<typeof db, "execute" | "select" | "update">>) => {
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
        // oxlint-disable-next-line no-ternary -- Keep heads as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
                    copy.plan.sourceHeads.map(
                      (
                        head: Readonly<{
                          documentId: string;
                          revisionId: string;
                        }>
                      ) => head.documentId
                    )
                  )
                )
              )
          : [];
      if (
        heads.length !== copy.plan.sourceHeads.length ||
        copy.plan.sourceHeads.some(
          (expected: Readonly<{ documentId: string; revisionId: string }>) =>
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
        receipts.some(
          (receipt: { readonly writtenAt: Readonly<Date> | null }) =>
            !receipt.writtenAt
        )
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
    }
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (acceptEveCopy, writeEveCopyDocuments, writeEveCopyFile); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, unicorn/max-nested-calls, unicorn/no-null */
export { acceptEveCopy, writeEveCopyDocuments, writeEveCopyFile };
/* oxlint-enable import/no-named-export */
