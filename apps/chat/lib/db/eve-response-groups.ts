import { createHash } from "node:crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { eveResponseGroupCandidates } from "../eve/response-group-candidates";
import { eveResponseGroupResult } from "../eve/response-group-contracts";
import { eveResponseGroupInput } from "../eve/response-group-input";
import { db } from "./client";
import { eveConversation, eveResponseGroup } from "./schema";

/** Reserve every candidate under the same owner lock used by family deletion. */
export async function reserveEveResponseGroup(
  ownerId: string,
  value: z.infer<typeof eveResponseGroupInput>
) {
  const result = await db.transaction((tx) =>
    reserveGroupRow(tx, ownerId, value)
  );
  return requireGroup(result);
}

/** Must commit with guest quota when admitting an anonymous comparison. */
export async function reserveEveResponseGroupInTransaction(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerId: string,
  value: z.infer<typeof eveResponseGroupInput>
) {
  return requireGroup(await reserveGroupRow(tx, ownerId, value));
}

async function reserveGroupRow(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerId: string,
  value: z.infer<typeof eveResponseGroupInput>
) {
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
    return undefined;
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
      ownerId,
      operationId: input.operationId,
      inputHash,
      candidates,
      candidateOperationIds: candidates.map(
        (candidate) => candidate.operationId
      ),
      sourceConversationId: sourceId,
      sourceIdentityKnown: true,
    })
    .returning();
  return group;
}

function requireGroup(result: Awaited<ReturnType<typeof reserveGroupRow>>) {
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
}

/** Caller holds the owner family lock; retain identities but erase request metadata. */
export async function tombstoneEveResponseGroups(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerId: string,
  family: Array<{ id: string; operationId: string }>
) {
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
    .set({ deleted: true, inputHash: null, candidates: null })
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
}

/** Clear an old rejection before retry; only a definitive result may replace it. */
export async function recordEveResponseGroupRejection(
  ownerId: string,
  groupId: string,
  operationId: string,
  rejection?: { error: string; code?: "project_not_found" }
) {
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
}

/** Owner-only ordered bindings; transcript content remains in native sessions. */
export async function getEveResponseGroup(ownerId: string, id: string) {
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
    return undefined;
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
    return undefined;
  }
  return eveResponseGroupResult.parse({
    id: group.id,
    candidates: group.candidates.map((candidate) => {
      const identity = {
        operationId: candidate.operationId,
        modelId: candidate.modelId,
      };
      const row = conversations.find(
        (conversation) => conversation.operationId === candidate.operationId
      );
      if (row?.state === "bound" && row.sessionId) {
        return {
          ...identity,
          state: "bound",
          conversationId: row.id,
          sessionId: row.sessionId,
        };
      }
      if (row) {
        return { ...identity, state: "unresolved" };
      }
      return candidate.rejection
        ? { ...identity, state: "rejected", ...candidate.rejection }
        : { ...identity, state: "waiting" };
    }),
  });
}

export async function getEveResponseGroupForConversation(
  ownerId: string,
  conversationId: string
) {
  const [conversation] = await db
    .select({ operationId: eveConversation.operationId })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.state, "bound")
      )
    );
  if (!conversation) {
    return undefined;
  }
  const [group] = await db
    .select({ id: eveResponseGroup.id })
    .from(eveResponseGroup)
    .where(
      and(
        eq(eveResponseGroup.ownerId, ownerId),
        eq(eveResponseGroup.deleted, false),
        sql`${conversation.operationId}::uuid = ANY(${eveResponseGroup.candidateOperationIds})`
      )
    );
  return group ? await getEveResponseGroup(ownerId, group.id) : undefined;
}
