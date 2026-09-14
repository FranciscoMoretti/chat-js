import { createHash } from "node:crypto";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { z } from "zod";

import { eveResponseGroupCandidates } from "../eve/response-group-candidates";
import { eveResponseGroupResult } from "../eve/response-group-contracts";
import { eveResponseGroupInput } from "../eve/response-group-input";
import { resolveEveResponseGroupLineage } from "../eve/response-group-lineage";
import { db } from "./client";
import { eveConversation, eveResponseGroup } from "./schema";

const reserveGroupRow = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerId: string,
  value: z.infer<typeof eveResponseGroupInput>
) => {
  const input = eveResponseGroupInput.parse(value);
  const inputHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
  );
  const condition = and(
    eq(eveResponseGroup.ownerId, ownerId),
    eq(eveResponseGroup.operationId, input.operationId)
  );
  const [existing] = await tx.select().from(eveResponseGroup).where(condition);
  if (existing?.deleted) {
    throw new Error("This response group has been deleted.");
  }
  if (existing && existing.inputHash !== inputHash) {
    throw new Error(
      "This response group already has a different message, model order, tool selection, or source."
    );
  }
  const sourceId = input.fork?.conversationId ?? null;
  const [source] = sourceId
    ? await tx
        .select()
        .from(eveConversation)
        .where(
          and(
            eq(eveConversation.id, sourceId),
            eq(eveConversation.ownerId, ownerId)
          )
        )
    : [];
  if (sourceId && !source) {
    throw new Error("Source conversation not found.");
  }
  // An exact replay can recover the missing association of a pre-contract group.
  // Commit it even when the source has since retired, so deletion can find it.
  if (existing && !existing.sourceIdentityKnown) {
    await tx
      .update(eveResponseGroup)
      .set({ sourceConversationId: sourceId, sourceIdentityKnown: true })
      .where(condition);
  }
  if (source && source.state !== "bound") {
    return;
  }
  if (existing) {
    return existing;
  }
  const candidates = eveResponseGroupCandidates(
    input.operationId,
    input.modelIds
  );
  const [group] = await tx
    .insert(eveResponseGroup)
    .values({
      candidateOperationIds: candidates.map(
        (candidate) => candidate.operationId
      ),
      candidates,
      inputHash,
      operationId: input.operationId,
      ownerId,
      sourceConversationId: sourceId,
      sourceIdentityKnown: true,
    })
    .returning();
  return group;
};

const requireGroup = (result: Awaited<ReturnType<typeof reserveGroupRow>>) => {
  if (!result) {
    throw new Error("Source conversation is unavailable.");
  }
  if (!(result.candidates && result.inputHash)) {
    throw new Error("Response group content is unavailable.");
  }
  return {
    ...result,
    candidates: result.candidates,
    inputHash: result.inputHash,
  };
};

/** Reserve every candidate under the same owner lock used by family deletion. */
export const reserveEveResponseGroup = async (
  ownerId: string,
  value: z.infer<typeof eveResponseGroupInput>
) => {
  const result = await db.transaction((tx) =>
    reserveGroupRow(tx, ownerId, value)
  );
  return requireGroup(result);
};

/** Must commit with guest quota when admitting an anonymous comparison. */
export const reserveEveResponseGroupInTransaction = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerId: string,
  value: z.infer<typeof eveResponseGroupInput>
) => requireGroup(await reserveGroupRow(tx, ownerId, value));

/** Caller holds the owner family lock; retain identities but erase request metadata. */
export const tombstoneEveResponseGroups = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerId: string,
  family: {
    id: string;
    operationId: string;
  }[]
) => {
  const [unknown] = await tx
    .select({ id: eveResponseGroup.id })
    .from(eveResponseGroup)
    .where(
      and(
        eq(eveResponseGroup.ownerId, ownerId),
        eq(eveResponseGroup.sourceIdentityKnown, false),
        eq(eveResponseGroup.deleted, false)
      )
    )
    .limit(1);
  if (unknown) {
    throw new Error(
      "Recover saved response group requests before deleting conversations."
    );
  }
  const operations = sql`ARRAY[${sql.join(
    family.map((row) => sql`${row.operationId}::uuid`),
    sql`, `
  )}]`;
  await tx
    .update(eveResponseGroup)
    .set({ candidates: null, deleted: true, inputHash: null })
    .where(
      and(
        eq(eveResponseGroup.ownerId, ownerId),
        or(
          inArray(
            eveResponseGroup.sourceConversationId,
            family.map((row) => row.id)
          ),
          sql`${eveResponseGroup.candidateOperationIds} && ${operations}`
        )
      )
    );
};

/** Clear an old rejection before retry; only a definitive result may replace it. */
export const recordEveResponseGroupRejection = async (
  ownerId: string,
  groupId: string,
  operationId: string,
  rejection?: {
    error: string;
    code?: "project_not_found";
  }
) => {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const condition = and(
      eq(eveResponseGroup.ownerId, ownerId),
      eq(eveResponseGroup.id, groupId),
      eq(eveResponseGroup.deleted, false)
    );
    const [group] = await tx.select().from(eveResponseGroup).where(condition);
    if (
      !group?.candidates?.some(
        (candidate) => candidate.operationId === operationId
      )
    ) {
      throw new Error("Response group is unavailable.");
    }
    const candidates = group.candidates.map((candidate) =>
      candidate.operationId === operationId
        ? {
            modelId: candidate.modelId,
            operationId,
            ...(rejection ? { rejection } : {}),
          }
        : candidate
    );
    await tx.update(eveResponseGroup).set({ candidates }).where(condition);
  });
};

/** Owner-only ordered bindings; transcript content remains in native sessions. */
export const getEveResponseGroup = async (ownerId: string, id: string) => {
  const [group] = await db
    .select()
    .from(eveResponseGroup)
    .where(
      and(
        eq(eveResponseGroup.id, id),
        eq(eveResponseGroup.ownerId, ownerId),
        eq(eveResponseGroup.deleted, false)
      )
    );
  if (!group?.candidates) {
    return;
  }
  const conversations = await db
    .select()
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        inArray(eveConversation.operationId, group.candidateOperationIds)
      )
    );
  if (
    conversations.some(
      (row) => row.state === "deleting" || row.state === "deleted"
    )
  ) {
    return;
  }
  return eveResponseGroupResult.parse({
    candidates: group.candidates.map((candidate) => {
      const identity = {
        modelId: candidate.modelId,
        operationId: candidate.operationId,
      };
      const row = conversations.find(
        (conversation) => conversation.operationId === candidate.operationId
      );
      if (row?.state === "bound" && row.sessionId) {
        return {
          ...identity,
          conversationId: row.id,
          sessionId: row.sessionId,
          state: "bound",
        };
      }
      if (row) {
        return { ...identity, state: "unresolved" };
      }
      return candidate.rejection
        ? { ...identity, state: "rejected", ...candidate.rejection }
        : { ...identity, state: "waiting" };
    }),
    id: group.id,
  });
};

export const getEveResponseGroupForConversation = async (
  ownerId: string,
  conversationId: string
) => {
  const [conversation] = await db
    .select({
      id: eveConversation.id,
      rootConversationId: eveConversation.rootConversationId,
    })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.state, "bound")
      )
    );
  if (!conversation) {
    return;
  }
  const rootId = conversation.rootConversationId ?? conversation.id;
  const family = await db
    .select({
      createdAt: eveConversation.createdAt,
      forkKind: eveConversation.forkKind,
      forkMessageId: eveConversation.forkMessageId,
      forkTurnId: eveConversation.forkTurnId,
      id: eveConversation.id,
      operationId: eveConversation.operationId,
      parentConversationId: eveConversation.parentConversationId,
      sessionId: eveConversation.sessionId,
    })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.state, "bound"),
        or(
          eq(eveConversation.id, rootId),
          eq(eveConversation.rootConversationId, rootId)
        )
      )
    );
  const boundFamily = family.flatMap((member) =>
    member.sessionId ? [{ ...member, sessionId: member.sessionId }] : []
  );
  if (!boundFamily.length) {
    return;
  }
  const operationIds = sql`ARRAY[${sql.join(
    boundFamily.map((member) => sql`${member.operationId}::uuid`),
    sql`, `
  )}]`;
  const groups = await db
    .select({
      candidateOperationIds: eveResponseGroup.candidateOperationIds,
      id: eveResponseGroup.id,
    })
    .from(eveResponseGroup)
    .where(
      and(
        eq(eveResponseGroup.ownerId, ownerId),
        eq(eveResponseGroup.deleted, false),
        sql`${eveResponseGroup.candidateOperationIds} && ${operationIds}`,
        or(
          isNull(eveResponseGroup.sourceConversationId),
          inArray(
            eveResponseGroup.sourceConversationId,
            boundFamily.map((member) => member.id)
          )
        )
      )
    );
  const lineage = resolveEveResponseGroupLineage(
    conversationId,
    boundFamily,
    groups
  );
  if (!lineage) {
    return;
  }
  const lineageGroup = groups.find((group) => group.id === lineage.groupId);
  if (!lineageGroup) {
    return;
  }
  const candidateConversations = await db
    .select({
      id: eveConversation.id,
      rootConversationId: eveConversation.rootConversationId,
    })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.state, "bound"),
        inArray(eveConversation.operationId, lineageGroup.candidateOperationIds)
      )
    );
  const candidateRootIds = [
    ...new Set(
      candidateConversations.map(
        (candidate) => candidate.rootConversationId ?? candidate.id
      )
    ),
  ];
  if (!candidateRootIds.length) {
    return;
  }
  const groupFamilies = await db
    .select({
      createdAt: eveConversation.createdAt,
      forkKind: eveConversation.forkKind,
      forkMessageId: eveConversation.forkMessageId,
      forkTurnId: eveConversation.forkTurnId,
      id: eveConversation.id,
      operationId: eveConversation.operationId,
      parentConversationId: eveConversation.parentConversationId,
      sessionId: eveConversation.sessionId,
    })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.state, "bound"),
        or(
          inArray(eveConversation.id, candidateRootIds),
          inArray(eveConversation.rootConversationId, candidateRootIds)
        )
      )
    );
  const boundGroupFamilies = groupFamilies.flatMap((member) =>
    member.sessionId ? [{ ...member, sessionId: member.sessionId }] : []
  );
  const groupLineage = resolveEveResponseGroupLineage(
    conversationId,
    boundGroupFamilies,
    [lineageGroup]
  );
  if (!groupLineage) {
    return;
  }
  const group = await getEveResponseGroup(ownerId, lineage.groupId);
  if (!group) {
    return;
  }
  return eveResponseGroupResult.parse({
    ...group,
    candidates: group.candidates.map((candidate) => {
      const replacement = groupLineage.replacements.get(candidate.operationId);
      return candidate.state === "bound" && replacement
        ? { ...candidate, ...replacement }
        : candidate;
    }),
  });
};
