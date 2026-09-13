import { createHash } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { parseSessionTranscriptSeed } from "eve/transcript";
import { z } from "zod";

import type { EveCopyPlan } from "../eve/copy-journal-contract";
import { eveCopyResources } from "../eve/copy-transcript";
import { isFileStorageKey } from "../file-url";
import { db } from "./client";
import { CreationConflict } from "./eve-queries";
import {
  eveConversation,
  eveConversationCopy,
  eveConversationCopyFile,
  eveFileReference,
  eveResponseGroup,
  eveStoredFile,
} from "./schema";

type CopyTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const hashPattern = /^[a-f0-9]{64}$/;

export class EveCopySourceChanged extends CreationConflict {}

/** Durable rejection prevents a concurrent request from later reserving the discarded operation. */
export async function rejectEveCopyPreflight(
  ownerId: string,
  operationId: string
) {
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
    await tx.insert(eveConversation).values({
      ownerId,
      operationId,
      creationKind: "copy",
      state: "deleted",
      firstMessage: "",
    });
  });
}

export async function isUnacceptedEveCopy(
  ownerId: string,
  conversationId: string
) {
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
}

/** Caller holds source/destination family locks; the shared row lock serializes revocation. */
export async function assertEveCopySourceAvailable(
  tx: CopyTransaction,
  source: {
    sourceConversationId: string;
    sourceSessionId: string;
    sourceOwnerId: string;
  }
) {
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
    throw new EveCopySourceChanged(
      "Sharing was revoked before the copy was accepted."
    );
  }
}

export async function lockEveCopyOwners(tx: CopyTransaction, owners: string[]) {
  for (const owner of [...new Set(owners)].sort()) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${owner}`}, 0))`
    );
  }
}

export async function readEveCopy(
  tx: Pick<CopyTransaction, "select">,
  ownerId: string,
  conversationId: string
) {
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
    throw new CreationConflict("Saved copy operation not found.");
  }
  return row;
}

export async function getEveCopyOperation(
  ownerId: string,
  operationId: string
) {
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
    return undefined;
  }
  if (conversation.creationKind !== "copy") {
    throw new CreationConflict(
      "This operation belongs to ordinary message creation."
    );
  }
  return await readEveCopy(db, ownerId, conversation.id);
}

/** Allocation and source authorization are committed before any destination storage I/O. */
export async function reserveEveCopyOperation(
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
) {
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
        throw new CreationConflict(
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
        throw new CreationConflict(
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
      throw new CreationConflict(
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
      throw new CreationConflict("Shared conversation is unavailable.");
    }
    await assertSourceFiles(
      tx,
      input.sourceOwnerId,
      input.sourceConversationId,
      input.plan
    );
    const [conversation] = await tx
      .insert(eveConversation)
      .values({
        ownerId,
        operationId: input.operationId,
        creationKind: "copy",
        firstMessage: input.title,
        initialModelId: input.modelId,
        initialContentHash: input.projectionHash,
      })
      .returning();
    await tx.insert(eveConversationCopy).values({
      conversationId: conversation.id,
      ownerId,
      sourceConversationId: input.sourceConversationId,
      sourceSessionId: input.sourceSessionId,
      sourceOwnerId: input.sourceOwnerId,
      projectionHash: input.projectionHash,
      planHash,
      plan: input.plan,
    });
    if (input.plan.files.length) {
      await tx
        .insert(eveStoredFile)
        .values(input.plan.files.map((file) => ({ key: file.key, ownerId })));
      await tx.insert(eveFileReference).values(
        input.plan.files.map((file) => ({
          key: file.key,
          ownerId,
          conversationId: conversation.id,
        }))
      );
      await tx.insert(eveConversationCopyFile).values(
        input.plan.files.map((file) => ({
          key: file.key,
          ownerId,
          conversationId: conversation.id,
          sha256: file.sha256,
          size: file.size,
          mediaType: file.mediaType,
        }))
      );
    }
    return await readEveCopy(tx, ownerId, conversation.id);
  });
}

async function assertSourceFiles(
  tx: CopyTransaction,
  ownerId: string,
  conversationId: string,
  plan: EveCopyPlan
) {
  const keys = [
    ...new Set(
      plan.files.flatMap((file) =>
        file.source.kind === "stored" ? [file.source.key] : []
      )
    ),
  ];
  if (!keys.length) {
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
}

function validateCopyPlan(plan: EveCopyPlan) {
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
    eveCopyResources({ seed: plan.seed, documents: plan.documents }).fileKeys
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
}

function validateCopyDocumentCheckpoints(plan: EveCopyPlan) {
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
}
