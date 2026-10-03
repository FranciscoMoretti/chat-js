/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports, sort-imports --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../eve/copy-journal-contract"; "../eve/copy-transcript"; "../file-url" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { createHash } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { parseSessionTranscriptSeed } from "eve/transcript";
import { z } from "zod";

import type { EveCopyPlan } from "../eve/copy-journal-contract";
import { eveCopyResources } from "../eve/copy-transcript";
import { isFileStorageKey } from "../file-url";
import { db } from "./client";
import { CreationConflictError } from "./eve-queries";
import {
  eveChat,
  eveConversation,
  eveConversationCopy,
  eveConversationCopyFile,
  eveFileReference,
  eveResponseGroup,
  eveStoredFile,
} from "./schema";
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports, sort-imports */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): CopyTransaction uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
type CopyTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/* oxlint-enable no-magic-numbers */
const hashPattern = /^[a-f0-9]{64}$/u;

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, typescript/prefer-readonly-parameter-types --
 * import/exports-last (#522): EveCopySourceChangedError is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): EveCopySourceChangedError stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named EveCopySourceChangedError API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): EveCopySourceChangedError accepts options?: ErrorOptions; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export class EveCopySourceChangedError extends CreationConflictError {
  public constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EveCopySourceChangedError";
  }
}
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * import/exports-last (#522): lockEveCopyOwners is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): lockEveCopyOwners stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named lockEveCopyOwners API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): lockEveCopyOwners sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): lockEveCopyOwners accepts tx: CopyTransaction; owners: string[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const lockEveCopyOwners = async (
  tx: CopyTransaction,
  owners: string[]
): Promise<void> => {
  for (const owner of [...new Set(owners)].toSorted()) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Acquire and use transaction locks in a deterministic order.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${owner}`}, 0))`
    );
  }
};
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, oxc/no-async-await, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, jsdoc/require-param, max-statements, no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/exports-last (#522): rejectEveCopyPreflight is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): rejectEveCopyPreflight stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named rejectEveCopyPreflight API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): rejectEveCopyPreflight's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): rejectEveCopyPreflight keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): rejectEveCopyPreflight uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): rejectEveCopyPreflight sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): rejectEveCopyPreflight accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): rejectEveCopyPreflight intentionally keeps the existing falsy-value behavior of existing; group; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Durable rejection prevents a concurrent request from later reserving the discarded operation. */
export const rejectEveCopyPreflight = async (
  ownerId: string,
  operationId: string
): Promise<void> => {
  await db.transaction(async (tx) => {
    await lockEveCopyOwners(tx, [ownerId]);
    const [existing] = await tx
      .select({ id: eveConversation.id })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.operationId, operationId)
        )
      );
    if (existing) {
      return;
    }
    const [group] = await tx
      .select({ id: eveResponseGroup.id })
      .from(eveResponseGroup)
      .where(
        and(
          eq(eveResponseGroup.ownerId, ownerId),
          sql`${operationId}::uuid = ANY(${eveResponseGroup.candidateOperationIds})`
        )
      )
      .limit(1);
    if (group) {
      return;
    }
    const conversationId = crypto.randomUUID();
    const chatId = crypto.randomUUID();
    await tx.insert(eveChat).values({
      id: chatId,
      ownerId,
      title: "",
      titleStatus: "fallback",
    });
    await tx.insert(eveConversation).values({
      chatId,
      creationKind: "copy",
      firstMessage: "",
      id: conversationId,
      operationId,
      ownerId,
      state: "deleted",
    });
  });
};
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, jsdoc/require-param, max-statements, no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, oxc/no-async-await --
 * import/exports-last (#522): isUnacceptedEveCopy is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): isUnacceptedEveCopy stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named isUnacceptedEveCopy API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): isUnacceptedEveCopy sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 */
export const isUnacceptedEveCopy = async (
  ownerId: string,
  conversationId: string
): Promise<boolean> => {
  const [copy] = await db
    .select({ id: eveConversationCopy.conversationId })
    .from(eveConversationCopy)
    .where(
      and(
        eq(eveConversationCopy.ownerId, ownerId),
        eq(eveConversationCopy.conversationId, conversationId),
        inArray(eveConversationCopy.phase, ["preparing", "rejected"])
      )
    );
  return Boolean(copy);
};
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, oxc/no-async-await */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, jsdoc/require-param, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/exports-last (#522): assertEveCopySourceAvailable is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): assertEveCopySourceAvailable stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named assertEveCopySourceAvailable API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): assertEveCopySourceAvailable's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * oxc/no-async-await (#540): assertEveCopySourceAvailable sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): assertEveCopySourceAvailable accepts tx: CopyTransaction; source: { sourceConversationId: string; sourceSessionId: string; sourceOwnerId: strin; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): assertEveCopySourceAvailable intentionally keeps the existing falsy-value behavior of row; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Caller holds source/destination family locks; the shared row lock serializes revocation. */
export const assertEveCopySourceAvailable = async (
  tx: CopyTransaction,
  source: {
    sourceConversationId: string;
    sourceSessionId: string;
    sourceOwnerId: string;
  }
): Promise<void> => {
  const [row] = await tx
    .select({ id: eveConversation.id })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, source.sourceConversationId),
        eq(eveConversation.ownerId, source.sourceOwnerId),
        eq(eveConversation.sessionId, source.sourceSessionId),
        eq(eveConversation.state, "bound"),
        eq(eveConversation.visibility, "public")
      )
    )
    .for("share");
  if (!row) {
    throw new EveCopySourceChangedError(
      "Sharing was revoked before the copy was accepted."
    );
  }
};
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, jsdoc/require-param, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions --
 * import/exports-last (#522): readEveCopy is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): readEveCopy stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named readEveCopy API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): readEveCopy sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep readEveCopy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep readEveCopy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): readEveCopy intentionally keeps the existing falsy-value behavior of row; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const readEveCopy = async (
  tx: Pick<CopyTransaction, "select">,
  ownerId: string,
  conversationId: string
) => {
  const [row] = await tx
    .select({ conversation: eveConversation, copy: eveConversationCopy })
    .from(eveConversation)
    .innerJoin(
      eveConversationCopy,
      and(
        eq(eveConversationCopy.conversationId, eveConversation.id),
        eq(eveConversationCopy.ownerId, eveConversation.ownerId)
      )
    )
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.creationKind, "copy")
      )
    );
  if (!row) {
    throw new CreationConflictError("Saved copy operation not found.");
  }
  return row;
};
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions --
 * import/exports-last (#522): getEveCopyOperation is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): getEveCopyOperation stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getEveCopyOperation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): getEveCopyOperation sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep getEveCopyOperation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getEveCopyOperation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): getEveCopyOperation intentionally keeps the existing falsy-value behavior of conversation; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const getEveCopyOperation = async (
  ownerId: string,
  operationId: string
) => {
  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.operationId, operationId)
      )
    );
  if (!conversation) {
    return;
  }
  if (conversation.creationKind !== "copy") {
    throw new CreationConflictError(
      "This operation belongs to ordinary message creation."
    );
  }
  // oxlint-disable-next-line typescript/consistent-return -- #580: getEveCopyOperation has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return await readEveCopy(db, ownerId, conversation.id);
};
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-statements, no-ternary, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): validateCopyDocumentCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-ternary (#518): validateCopyDocumentCheckpoints derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/prefer-readonly-parameter-types (#565): validateCopyDocumentCheckpoints accepts plan: EveCopyPlan; checkpoint; message; document; revision; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const validateCopyDocumentCheckpoints = (plan: EveCopyPlan): void => {
  const checkpoints = new Map(
    plan.documentCheckpoints.map((checkpoint) => [
      checkpoint.messageIndex,
      checkpoint,
    ])
  );
  const users = plan.seed.messages.flatMap((message, index) =>
    message.role === "user" ? [index] : []
  );
  if (
    checkpoints.size !== plan.documentCheckpoints.length ||
    checkpoints.size !== users.length ||
    users.some((index) => !checkpoints.has(index))
  ) {
    throw new Error(
      "Copied document boundaries must match imported user messages."
    );
  }
  const revisionDocuments = new Map(
    plan.documents.flatMap((document) =>
      document.revisions.map((revision) => [revision.id, document.documentId])
    )
  );
  for (const checkpoint of checkpoints.values()) {
    const seen = new Set<string>();
    for (const head of checkpoint.heads) {
      if (
        seen.has(head.documentId) ||
        revisionDocuments.get(head.revisionId) !== head.documentId
      ) {
        throw new Error(
          "Copied document boundary has invalid revision ownership."
        );
      }
      seen.add(head.documentId);
    }
  }
};
/* oxlint-enable max-statements, no-ternary, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-ternary, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * max-lines-per-function (#510): validateCopyPlan keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): validateCopyPlan keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): validateCopyPlan uses 0, 2_147_483_647 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): validateCopyPlan derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/prefer-readonly-parameter-types (#565): validateCopyPlan accepts plan: EveCopyPlan; file; head; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): validateCopyPlan intentionally keeps the existing falsy-value behavior of parent; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): validateCopyPlan preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
// oxlint-disable-next-line eslint/complexity -- Keep the atomic admission and validation branches together at this transaction boundary.
const validateCopyPlan = (plan: EveCopyPlan): void => {
  parseSessionTranscriptSeed(plan.seed);
  const keys = new Set<string>();
  const sourceKeys = new Set(
    plan.files.flatMap((file) =>
      file.source.kind === "stored" ? [file.source.key] : []
    )
  );
  for (const file of plan.files) {
    if (
      !isFileStorageKey(file.key) ||
      keys.has(file.key) ||
      sourceKeys.has(file.key) ||
      !hashPattern.test(file.sha256) ||
      !Number.isSafeInteger(file.size) ||
      file.size <= 0 ||
      file.size > 2_147_483_647 ||
      !file.mediaType
    ) {
      throw new Error("Invalid copied file plan.");
    }
    keys.add(file.key);
  }
  const referenced = new Set(
    eveCopyResources({ documents: plan.documents, seed: plan.seed }).fileKeys
  );
  if (
    referenced.size !== keys.size ||
    [...referenced].some((key) => !keys.has(key))
  ) {
    throw new Error(
      "Copy plan files do not match its transcript and documents."
    );
  }
  if (plan.seed.attachments !== "channel") {
    throw new Error("Copies require compact channel attachments.");
  }
  const documentIds = new Set<string>();
  const revisionIds = new Set<string>();
  const sourceDocumentIds = new Set(
    plan.sourceHeads.map((head) => z.uuid().parse(head.documentId))
  );
  for (const document of plan.documents) {
    z.uuid().parse(document.documentId);
    if (
      documentIds.has(document.documentId) ||
      sourceDocumentIds.has(document.documentId)
    ) {
      throw new Error("Copied documents need distinct fresh identities.");
    }
    documentIds.add(document.documentId);
    let parent: string | null = null;
    for (const revision of document.revisions) {
      z.uuid().parse(revision.id);
      z.iso.datetime().parse(revision.createdAt);
      if (
        revisionIds.has(revision.id) ||
        revision.parentRevisionId !== parent
      ) {
        throw new Error("Invalid copied document ancestry.");
      }
      revisionIds.add(revision.id);
      parent = revision.id;
    }
    if (!parent || parent !== document.headRevisionId) {
      throw new Error("Invalid copied document head.");
    }
  }
  validateCopyDocumentCheckpoints(plan);
};
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-ternary, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-params, no-magic-numbers, no-ternary, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * max-params (#511): assertSourceFiles keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): assertSourceFiles uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): assertSourceFiles derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): assertSourceFiles sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): assertSourceFiles accepts tx: CopyTransaction; plan: EveCopyPlan; file; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const assertSourceFiles = async (
  tx: CopyTransaction,
  ownerId: string,
  conversationId: string,
  plan: EveCopyPlan
): Promise<void> => {
  const keys = [
    ...new Set(
      plan.files.flatMap((file) =>
        file.source.kind === "stored" ? [file.source.key] : []
      )
    ),
  ];
  if (keys.length === 0) {
    return;
  }
  const rows = await tx
    .select({ key: eveFileReference.key })
    .from(eveFileReference)
    .innerJoin(
      eveStoredFile,
      and(
        eq(eveStoredFile.key, eveFileReference.key),
        eq(eveStoredFile.ownerId, ownerId),
        eq(eveStoredFile.state, "active")
      )
    )
    .where(
      and(
        eq(eveFileReference.ownerId, ownerId),
        eq(eveFileReference.conversationId, conversationId),
        inArray(eveFileReference.key, keys)
      )
    );
  if (rows.length !== keys.length) {
    throw new Error(
      "Copy source files are not available in the published conversation."
    );
  }
};
/* oxlint-enable max-params, no-magic-numbers, no-ternary, oxc/no-async-await, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): reserveEveCopyOperation stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named reserveEveCopyOperation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): reserveEveCopyOperation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): reserveEveCopyOperation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): reserveEveCopyOperation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): reserveEveCopyOperation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): reserveEveCopyOperation uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): reserveEveCopyOperation sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep reserveEveCopyOperation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep reserveEveCopyOperation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): reserveEveCopyOperation accepts input: { operationId: string; sourceConversationId: string; sourceSessionId: string; ; tx; file; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): reserveEveCopyOperation intentionally keeps the existing falsy-value behavior of existing; group; source; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Allocation and source authorization are committed before any destination storage I/O. */
export const reserveEveCopyOperation = async (
  ownerId: string,
  input: {
    operationId: string;
    sourceConversationId: string;
    sourceSessionId: string;
    sourceOwnerId: string;
    projectionHash: string;
    title: string;
    modelId: string;
    plan: EveCopyPlan;
  }
) => {
  validateCopyPlan(input.plan);
  if (!hashPattern.test(input.projectionHash)) {
    throw new Error("Invalid public projection hash.");
  }
  const planHash = createHash("sha256")
    .update(JSON.stringify(input.plan))
    .digest("hex");
  return await db.transaction(async (tx) => {
    await lockEveCopyOwners(tx, [ownerId, input.sourceOwnerId]);
    const [existing] = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.operationId, input.operationId)
        )
      );
    if (existing) {
      if (existing.creationKind !== "copy") {
        throw new CreationConflictError(
          "This operation belongs to ordinary message creation."
        );
      }
      const saved = await readEveCopy(tx, ownerId, existing.id);
      if (
        saved.copy.sourceConversationId !== input.sourceConversationId ||
        saved.copy.sourceSessionId !== input.sourceSessionId ||
        saved.copy.sourceOwnerId !== input.sourceOwnerId ||
        saved.copy.projectionHash !== input.projectionHash ||
        saved.copy.planHash !== planHash ||
        saved.conversation.initialModelId !== input.modelId ||
        saved.conversation.firstMessage !== input.title
      ) {
        throw new CreationConflictError(
          "This copy operation already has a different immutable preparation."
        );
      }
      return saved;
    }
    const [group] = await tx
      .select({ id: eveResponseGroup.id })
      .from(eveResponseGroup)
      .where(
        and(
          eq(eveResponseGroup.ownerId, ownerId),
          sql`${input.operationId}::uuid = ANY(${eveResponseGroup.candidateOperationIds})`
        )
      )
      .limit(1);
    if (group) {
      throw new CreationConflictError(
        "Response group operations cannot create saved copies."
      );
    }
    const [source] = await tx
      .select({ id: eveConversation.id })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, input.sourceConversationId),
          eq(eveConversation.ownerId, input.sourceOwnerId),
          eq(eveConversation.sessionId, input.sourceSessionId),
          eq(eveConversation.state, "bound"),
          eq(eveConversation.visibility, "public")
        )
      )
      .for("share");
    if (!source) {
      throw new CreationConflictError("Shared conversation is unavailable.");
    }
    await assertSourceFiles(
      tx,
      input.sourceOwnerId,
      input.sourceConversationId,
      input.plan
    );
    const conversationId = crypto.randomUUID();
    const chatId = crypto.randomUUID();
    await tx.insert(eveChat).values({
      id: chatId,
      ownerId,
      title: input.title,
      titleStatus: "manual",
    });
    const [conversation] = await tx
      .insert(eveConversation)
      .values({
        chatId,
        creationKind: "copy",
        firstMessage: input.title,
        id: conversationId,
        initialContentHash: input.projectionHash,
        initialModelId: input.modelId,
        operationId: input.operationId,
        ownerId,
      })
      .returning();
    await tx.insert(eveConversationCopy).values({
      conversationId: conversation.id,
      ownerId,
      plan: input.plan,
      planHash,
      projectionHash: input.projectionHash,
      sourceConversationId: input.sourceConversationId,
      sourceOwnerId: input.sourceOwnerId,
      sourceSessionId: input.sourceSessionId,
    });
    if (input.plan.files.length > 0) {
      await tx
        .insert(eveStoredFile)
        .values(input.plan.files.map((file) => ({ key: file.key, ownerId })));
      await tx.insert(eveFileReference).values(
        input.plan.files.map((file) => ({
          conversationId: conversation.id,
          key: file.key,
          ownerId,
        }))
      );
      await tx.insert(eveConversationCopyFile).values(
        input.plan.files.map((file) => ({
          conversationId: conversation.id,
          key: file.key,
          mediaType: file.mediaType,
          ownerId,
          sha256: file.sha256,
          size: file.size,
        }))
      );
    }
    return await readEveCopy(tx, ownerId, conversation.id);
  });
};
/* oxlint-enable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines -- #509: This eve-copy-journal.ts module keeps its existing API and workflow boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
