/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash } from "node:crypto";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { and, eq, inArray, sql } from "drizzle-orm";
/* oxlint-enable sort-imports */
import { parseSessionTranscriptSeed } from "eve/transcript";
import { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveCopyPlan } from "@/lib/eve/copy-journal-contract";
/* oxlint-enable sort-imports */
import { eveCopyResources } from "@/lib/eve/copy-transcript";
import { isFileStorageKey } from "@/lib/file-url";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "./client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { CreationConflictError } from "./eve-queries";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveChat,
  eveConversation,
  eveConversationCopy,
  eveConversationCopyFile,
  eveFileReference,
  eveResponseGroup,
  eveStoredFile,
} from "./schema";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): CopyTransaction uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
type CopyTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ReserveEveCopyInput = Readonly<{
  operationId: string;
  sourceConversationId: string;
  sourceSessionId: string;
  sourceOwnerId: string;
  projectionHash: string;
  title: string;
  modelId: string;
  plan: EveCopyPlan;
}>;
type CopyWriteTransaction = Readonly<
  Pick<CopyTransaction, "execute" | "insert" | "select">
>;
/* oxlint-enable no-magic-numbers */
const hashPattern = /^[a-f0-9]{64}$/u;
const FIRST_ROW_INDEX = 0;
const SINGLE_ROW_LIMIT = 1;

interface EveCopyOperation {
  conversation: typeof eveConversation.$inferSelect;
  copy: typeof eveConversationCopy.$inferSelect;
}

type CopyDocumentCheckpointPlan = Readonly<{
  seed: Readonly<{
    messages: readonly Readonly<{ role: string }>[];
  }>;
  documentCheckpoints: readonly Readonly<{
    messageIndex: number;
    heads: readonly Readonly<{
      documentId: string;
      revisionId: string;
    }>[];
  }>[];
  documents: readonly Readonly<{
    documentId: string;
    revisions: readonly Readonly<{ id: string }>[];
  }>[];
}>;

type CopyPlanReader = Readonly<{
  seed: Readonly<{
    messages: readonly Readonly<{ role: string }>[];
    attachments?: EveCopyPlan["seed"]["attachments"];
  }>;
  documentCheckpoints: CopyDocumentCheckpointPlan["documentCheckpoints"];
  sourceHeads: readonly Readonly<{
    documentId: string;
    revisionId: string;
  }>[];
  files: readonly Readonly<{
    key: string;
    source: Readonly<
      { kind: "stored"; key: string } | { kind: "inline"; base64: string }
    >;
    sha256: string;
    size: number;
    mediaType: string;
  }>[];
  documents: readonly Readonly<{
    documentId: string;
    headRevisionId: string;
    revisions: readonly Readonly<{
      id: string;
      parentRevisionId: string | null;
      title: string;
      content: string;
      fileIds: readonly string[];
      kind: "text" | "code" | "sheet";
      createdAt: string;
    }>[];
  }>[];
}>;

type CopyPlanFilesReader = Readonly<{
  files: readonly Readonly<{
    source: Readonly<
      { kind: "stored"; key: string } | { kind: "inline"; base64: string }
    >;
  }>[];
}>;
type CopyPlanFileFields = Readonly<
  Pick<EveCopyPlan["files"][number], "key" | "mediaType" | "sha256" | "size">
>;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve hasEveResponseGroupOperation's awaited sequencing and rejected-Promise behavior. */
const hasEveResponseGroupOperation = async (
  tx: Readonly<Pick<CopyTransaction, "select">>,
  ownerId: string,
  operationId: string
): Promise<boolean> => {
  const rows = await tx
    .select({ id: eveResponseGroup.id })
    .from(eveResponseGroup)
    .where(
      and(
        eq(eveResponseGroup.ownerId, ownerId),
        sql`${operationId}::uuid = ANY(${eveResponseGroup.candidateOperationIds})`
      )
    )
    .limit(SINGLE_ROW_LIMIT);
  return rows.length === SINGLE_ROW_LIMIT;
};
/* oxlint-enable oxc/no-async-await */
class EveCopySourceChangedError extends CreationConflictError {
  public constructor(message?: string, options?: Readonly<ErrorOptions>) {
    super(message, options);
    this.name = "EveCopySourceChangedError";
  }
}
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve lockEveCopyOwners's awaited sequencing and rejected-Promise behavior. */

const lockEveCopyOwners = async (
  tx: Readonly<Pick<CopyTransaction, "execute">>,
  owners: readonly string[]
): Promise<void> => {
  for (const owner of [...new Set(owners)].toSorted()) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Acquire and use transaction locks in a deterministic order.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${owner}`}, 0))`
    );
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve rejectEveCopyPreflight's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements -- moving it below executable initialization can obscure ordering and API ownership.
max-statements (#512): rejectEveCopyPreflight keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
/** Durable rejection prevents a concurrent request from later reserving the discarded operation.
 * @param {string} ownerId Owner whose operation is being discarded.
 * @param {string} operationId Immutable creation operation to mark as rejected.
 */
const rejectEveCopyPreflight = async (
  ownerId: string,
  operationId: string
): Promise<void> => {
  await db.transaction(
    async (
      tx: Readonly<Pick<CopyTransaction, "execute" | "insert" | "select">>
    ) => {
      await lockEveCopyOwners(tx, [ownerId]);
      const existingRows = await tx
        .select({ id: eveConversation.id })
        .from(eveConversation)
        .where(
          and(
            eq(eveConversation.ownerId, ownerId),
            eq(eveConversation.operationId, operationId)
          )
        );
      const existing = existingRows.at(FIRST_ROW_INDEX);
      if (existing) {
        return;
      }
      if (await hasEveResponseGroupOperation(tx, ownerId, operationId)) {
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
    }
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve isUnacceptedEveCopy's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements */

const isUnacceptedEveCopy = async (
  ownerId: string,
  conversationId: string
): Promise<boolean> => {
  const copyRows = await db
    .select({ id: eveConversationCopy.conversationId })
    .from(eveConversationCopy)
    .where(
      and(
        eq(eveConversationCopy.ownerId, ownerId),
        eq(eveConversationCopy.conversationId, conversationId),
        inArray(eveConversationCopy.phase, ["preparing", "rejected"])
      )
    );
  const copy = copyRows.at(FIRST_ROW_INDEX);
  return Boolean(copy);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve assertEveCopySourceAvailable's awaited sequencing and rejected-Promise behavior. */
/** Caller holds source/destination family locks; the shared row lock serializes revocation.
 * @param {CopyTransaction} tx Transaction holding the family locks and source sharing lock.
 * @param {{ readonly sourceConversationId: string; readonly sourceSessionId: string; readonly sourceOwnerId: string; }} source Published conversation and session identities expected by the copy.
 */

const assertEveCopySourceAvailable = async (
  tx: Readonly<Pick<CopyTransaction, "select">>,
  source: {
    readonly sourceConversationId: string;
    readonly sourceSessionId: string;
    readonly sourceOwnerId: string;
  }
): Promise<void> => {
  const rows = await tx
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
  const row = rows.at(FIRST_ROW_INDEX);
  if (!row) {
    throw new EveCopySourceChangedError(
      "Sharing was revoked before the copy was accepted."
    );
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readEveCopy's awaited sequencing and rejected-Promise behavior. */
const readEveCopy = async (
  tx: Pick<CopyTransaction, "select">,
  ownerId: string,
  conversationId: string
): Promise<EveCopyOperation> => {
  const rows = await tx
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
  const row = rows.at(FIRST_ROW_INDEX);
  if (!row) {
    throw new CreationConflictError("Saved copy operation not found.");
  }
  return row;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEveCopyOperation's awaited sequencing and rejected-Promise behavior. */
const getEveCopyOperation = async (
  ownerId: string,
  operationId: string
): Promise<EveCopyOperation | undefined> => {
  const conversationRows = await db
    .select()
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.operationId, operationId)
      )
    );
  const conversation = conversationRows.at(FIRST_ROW_INDEX);
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable max-statements --
 * max-statements (#512): validateCopyDocumentCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const validateCopyDocumentCheckpoints = (
  plan: CopyDocumentCheckpointPlan
): void => {
  const checkpoints = new Map(
    plan.documentCheckpoints.map((checkpoint) => [
      checkpoint.messageIndex,
      checkpoint,
    ])
  );
  const users = plan.seed.messages.flatMap((message, index) => {
    if (message.role === "user") {
      return [index];
    }
    return [];
  });
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
/* oxlint-enable max-statements */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, unicorn/no-null --
 * max-lines-per-function (#510): validateCopyPlan keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): validateCopyPlan keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): validateCopyPlan uses 0, 2_147_483_647 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * unicorn/no-null (#570): validateCopyPlan preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
// oxlint-disable-next-line eslint/complexity -- Keep the atomic admission and validation branches together at this transaction boundary.
const validateCopyPlan = (plan: CopyPlanReader): void => {
  parseSessionTranscriptSeed(plan.seed);
  const keys = new Set<string>();
  const sourceKeys = new Set(
    plan.files.flatMap(
      (
        file: Readonly<{
          source: Readonly<
            { kind: "stored"; key: string } | { kind: "inline"; base64: string }
          >;
        }>
      ) => {
        if (file.source.kind === "stored") {
          return [file.source.key];
        }
        return [];
      }
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
    plan.sourceHeads.map(
      (head: Readonly<{ documentId: string; revisionId: string }>) =>
        z.uuid().parse(head.documentId)
    )
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
    if (
      parent === null ||
      parent === "" ||
      parent !== document.headRevisionId
    ) {
      throw new Error("Invalid copied document head.");
    }
  }
  validateCopyDocumentCheckpoints(plan);
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve assertSourceFiles's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, unicorn/no-null */

/* oxlint-disable max-params, no-magic-numbers --
 * max-params (#511): assertSourceFiles keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): assertSourceFiles uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const assertSourceFiles = async (
  tx: Readonly<Pick<CopyTransaction, "select">>,
  ownerId: string,
  conversationId: string,
  plan: CopyPlanFilesReader
): Promise<void> => {
  const keys = [
    ...new Set(
      plan.files.flatMap((file) => {
        if (file.source.kind === "stored") {
          return [file.source.key];
        }
        return [];
      })
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reserveEveCopyOperation's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-params, no-magic-numbers */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers -- max-lines-per-function (#510): reserveEveCopyOperation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): reserveEveCopyOperation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): reserveEveCopyOperation uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
/** Allocation and source authorization are committed before any destination storage I/O.
 * @param {string} ownerId Owner of the fresh destination conversation.
 * @param {{ operationId: string; readonly sourceConversationId: string; readonly sourceSessionId: string; readonly sourceOwnerId: string; projectionHash: string; title: string; modelId: string; plan: EveCopyPlan; }} input Immutable source identity, projection and prepared resources for the copy.
 * @returns {Promise<EveCopyOperation>} The persisted preparation, including an identical prior reservation on retry.
 */
const reserveEveCopyOperation = async (
  ownerId: string,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The Drizzle JSONB insert requires the existing EveCopyPlan type; a readonly plan fails its native insert overload. Keep the original object and schema contract until the database JSON type can accept a readonly plan.
  input: ReserveEveCopyInput
): Promise<EveCopyOperation> => {
  validateCopyPlan(input.plan);
  if (!hashPattern.test(input.projectionHash)) {
    throw new Error("Invalid public projection hash.");
  }
  const planHash = createHash("sha256")
    .update(JSON.stringify(input.plan))
    .digest("hex");
  return await db.transaction(async (tx: CopyWriteTransaction) => {
    await lockEveCopyOwners(tx, [ownerId, input.sourceOwnerId]);
    const existingRows = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.operationId, input.operationId)
        )
      );
    const existing = existingRows.at(FIRST_ROW_INDEX);
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
    if (await hasEveResponseGroupOperation(tx, ownerId, input.operationId)) {
      throw new CreationConflictError(
        "Response group operations cannot create saved copies."
      );
    }
    const sourceRows = await tx
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
    const source = sourceRows.at(FIRST_ROW_INDEX);
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
      await tx.insert(eveStoredFile).values(
        input.plan.files.map((file: CopyPlanFileFields) => ({
          key: file.key,
          ownerId,
        }))
      );
      await tx.insert(eveFileReference).values(
        input.plan.files.map((file: CopyPlanFileFields) => ({
          conversationId: conversation.id,
          key: file.key,
          ownerId,
        }))
      );
      await tx.insert(eveConversationCopyFile).values(
        input.plan.files.map((file: CopyPlanFileFields) => ({
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (assertEveCopySourceAvailable, EveCopySourceChangedError, getEveCopyOperation, isUnacceptedEveCopy, lockEveCopyOwners, readEveCopy, rejectEveCopyPreflight, reserveEveCopyOperation); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers */

/* oxlint-disable max-lines -- #509: This eve-copy-journal.ts module keeps its existing API and workflow boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
export {
  assertEveCopySourceAvailable,
  EveCopySourceChangedError,
  getEveCopyOperation,
  isUnacceptedEveCopy,
  lockEveCopyOwners,
  readEveCopy,
  rejectEveCopyPreflight,
  reserveEveCopyOperation,
};
/* oxlint-enable import/no-named-export */
