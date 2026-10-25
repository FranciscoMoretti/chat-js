import { installedCreationFields } from "@/composition/generated/installed-shared";
import { pluginCreationInput } from "@/lib/eve/plugin-creation-input";
import {
  and,
  eq,
  getTableColumns,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { createHash } from "node:crypto";

import { eveResponseGroupCandidates } from "@/lib/eve/response-group-candidates";
import { eveResponseGroupInput } from "@/lib/eve/response-group-input";
import { eveResponseGroupResult } from "@/lib/eve/response-group-contracts";
import { resolveEveResponseGroupLineage } from "@/lib/eve/response-group-lineage";

import { db } from "./client";
import { eveConversation, eveResponseGroup, eveDispatch } from "./schema";
import type { z } from "zod";

const hasQueryRow: (row: unknown) => boolean = Boolean;

const isNonemptyString = (value: string | null | undefined): value is string =>
  typeof value === "string" && value !== "";

const FIRST_PARAMETER_INDEX = 0;
const EMPTY_FAMILY_SIZE = 0;
const SINGLE_MATCH_LIMIT = 1;

type ResponseGroupTransaction = Parameters<
  Parameters<typeof db.transaction>[typeof FIRST_PARAMETER_INDEX]
>[typeof FIRST_PARAMETER_INDEX];
type ResponseGroupTombstoneTransaction = Readonly<
  Pick<ResponseGroupTransaction, "select" | "update">
>;
type ResponseGroupWriteTransaction = Readonly<
  Pick<ResponseGroupTransaction, "select" | "execute" | "insert" | "update">
>;
type ResponseGroupRow = typeof eveResponseGroup.$inferSelect;
type ConversationRow = typeof eveConversation.$inferSelect;
type ReservedResponseGroup = ReadonlyNativeSurface<
  Omit<ResponseGroupRow, "candidates" | "inputHash"> & {
    candidates: NonNullable<ResponseGroupRow["candidates"]>;
    inputHash: string;
  }
>;

const hash = (request: unknown): string =>
  createHash("sha256").update(JSON.stringify(request)).digest("hex");

const legacyGroupHash = async (
  tx: ResponseGroupWriteTransaction,
  ownerId: string,
  existing: ReadonlyNativeSurface<ResponseGroupRow>,
  input: ReadonlyNativeSurface<z.infer<typeof eveResponseGroupInput>>,
  coreInput: Readonly<Record<string, unknown>>
): Promise<string> => {
  // Upgrade legacy hashes only after proving every non-plugin input matches.
  // The first candidate's pending request or dispatch journal retains its original assignment.
  const [original] = await tx
    .select({
      request: eveConversation.initialRequest,
      intent: eveDispatch.intent,
    })
    .from(eveConversation)
    .leftJoin(
      eveDispatch,
      and(
        eq(eveDispatch.conversationId, eveConversation.id),
        eq(eveDispatch.kind, "create")
      )
    )
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(
          eveConversation.operationId,
          existing.candidateOperationIds[0] ?? input.operationId
        )
      )
    );
  const originalInput = original?.request ?? original?.intent;
  const restored =
    originalInput !== null && typeof originalInput === "object"
      ? eveResponseGroupInput.parse({
          ...coreInput,
          ...pluginCreationInput(
            Object.fromEntries(Object.entries(originalInput))
          ),
        })
      : input;
  return hash(restored);
};

const reserveGroupRow = async (
  tx: ResponseGroupWriteTransaction,
  ownerId: string,
  value: ReadonlyNativeSurface<z.infer<typeof eveResponseGroupInput>>
): Promise<ResponseGroupRow | undefined> => {
  const input = eveResponseGroupInput.parse(value);
  const coreInput = Object.fromEntries(
    Object.entries(input).filter(([key]) => !(key in installedCreationFields))
  );
  const inputHash = hash(coreInput);
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
  if (hasQueryRow(existing) && existing.inputHash !== inputHash) {
    if (
      existing.inputHash !==
      (await legacyGroupHash(tx, ownerId, existing, input, coreInput))
    ) {
      throw new Error(
        "This response group already has a different message, model order, tool selection, or source."
      );
    }
    await tx.update(eveResponseGroup).set({ inputHash }).where(condition);
    existing.inputHash = inputHash;
  }

  const sourceId = input.fork?.conversationId ?? null;
  const [source] =
    typeof sourceId === "string" && sourceId !== ""
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
  if (typeof sourceId === "string" && sourceId !== "" && !hasQueryRow(source)) {
    throw new Error("Source conversation not found.");
  }
  // An exact replay can recover the missing association of a pre-contract group.
  // Commit it even when the source has since retired, so deletion can find it.
  if (hasQueryRow(existing) && !existing.sourceIdentityKnown) {
    await tx
      .update(eveResponseGroup)
      .set({ sourceConversationId: sourceId, sourceIdentityKnown: true })
      .where(condition);
  }
  if (hasQueryRow(source) && source.state !== "bound") {
    return undefined;
  }
  if (hasQueryRow(existing)) {
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
        (candidate: Readonly<{ modelId: string; operationId: string }>) =>
          candidate.operationId
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

const requireGroup = (
  result: ReadonlyNativeSurface<Awaited<ReturnType<typeof reserveGroupRow>>>
): ReservedResponseGroup => {
  if (!result) {
    throw new Error("Source conversation is unavailable.");
  }
  if (!(result.candidates && isNonemptyString(result.inputHash))) {
    throw new Error("Response group content is unavailable.");
  }
  return {
    ...result,
    candidates: result.candidates,
    inputHash: result.inputHash,
  };
};

/**
 * Reserve every candidate under the same owner lock used by family deletion.
 * @param {string} ownerId Owner whose family lock fences the comparison reservation.
 * @param {z.infer<typeof eveResponseGroupInput>} value Comparison input whose complete content hash and ordered candidates define replay identity.
 * @returns {Promise<ReservedResponseGroup>} The allocated or replayed group with available candidate content, after committing its reservation.
 */
const reserveEveResponseGroup = async (
  ownerId: string,
  value: ReadonlyNativeSurface<z.infer<typeof eveResponseGroupInput>>
): Promise<ReservedResponseGroup> => {
  const result = await db.transaction(
    async (tx: ResponseGroupWriteTransaction) =>
      await reserveGroupRow(tx, ownerId, value)
  );
  return requireGroup(result);
};

/**
 * Must commit with guest quota when admitting an anonymous comparison.
 * @param {ResponseGroupWriteTransaction} tx Native transaction capabilities shared with the caller's guest quota admission.
 * @param {string} ownerId Owner whose family lock fences the comparison reservation.
 * @param {z.infer<typeof eveResponseGroupInput>} value Comparison input whose hash and candidate order define replay identity.
 * @returns {Promise<ReservedResponseGroup>} The allocated or replayed group; the caller controls the shared transaction commit.
 */
const reserveEveResponseGroupInTransaction = async (
  tx: ResponseGroupWriteTransaction,
  ownerId: string,
  value: ReadonlyNativeSurface<z.infer<typeof eveResponseGroupInput>>
): Promise<ReservedResponseGroup> =>
  requireGroup(await reserveGroupRow(tx, ownerId, value));

/**
 * Caller holds the owner family lock; retain identities but erase request metadata.
 * @param {ResponseGroupTransaction} tx Native deletion transaction already holding the owner family lock.
 * @param {string} ownerId Owner whose source and candidate groups are tombstoned.
 * @param {{ id: string; operationId: string; }[]} family Conversation and operation identities defining the deleted family.
 */
const tombstoneEveResponseGroups = async (
  tx: ResponseGroupTombstoneTransaction,
  ownerId: string,
  family: readonly Readonly<{
    id: string;
    operationId: string;
  }>[]
): Promise<void> => {
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
    .limit(SINGLE_MATCH_LIMIT);
  const hasUnknownSource = hasQueryRow(unknown);
  if (hasUnknownSource) {
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

/**
 * Clear an old rejection before retry; only a definitive result may replace it.
 * @param {string} ownerId Owner whose family lock serializes the candidate update.
 * @param {string} groupId Live response group containing the candidate operation.
 * @param {string} operationId Exact candidate operation whose rejection is replaced or cleared.
 * @param {{ error: string; code?: string; } | undefined} rejection Definitive rejection details; absence clears the prior rejection for retry.
 */
const recordEveResponseGroupRejection = async (
  ownerId: string,
  groupId: string,
  operationId: string,
  rejection?: {
    readonly error: string;
    readonly code?: string;
  }
): Promise<void> => {
  await db.transaction(async (tx: ResponseGroupWriteTransaction) => {
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
      group?.candidates?.some(
        (candidate: { readonly operationId: string }) =>
          candidate.operationId === operationId
      ) !== true
    ) {
      throw new Error("Response group is unavailable.");
    }
    const candidates = group.candidates.map(
      (
        candidate: ReadonlyNativeSurface<
          NonNullable<ResponseGroupRow["candidates"]>[number]
        >
      ) => {
        if (candidate.operationId === operationId) {
          return {
            modelId: candidate.modelId,
            operationId,
            ...(rejection ? { rejection } : {}),
          };
        }
        return candidate;
      }
    );
    await tx.update(eveResponseGroup).set({ candidates }).where(condition);
  });
};

/**
 * Owner-only ordered bindings; transcript content remains in native sessions.
 * @param {string} ownerId Owner used to authorize group and conversation lookups.
 * @param {string} id Live response group whose original candidate order is preserved.
 * @returns {Promise<z.output<typeof eveResponseGroupResult> | undefined>} Parsed candidate binding or rejection states, or no result for missing or deleting groups.
 */
const getEveResponseGroup = async (
  ownerId: string,
  id: string
): Promise<z.output<typeof eveResponseGroupResult> | undefined> => {
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
    .select({
      ...getTableColumns(eveConversation),
      dispatched: sql<boolean>`exists (
      select 1 from "EveDispatch" dispatch where dispatch."conversationId" = ${eveConversation.id}
        and dispatch."ownerId" = ${ownerId}
    )`,
    })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        inArray(eveConversation.operationId, group.candidateOperationIds)
      )
    );
  if (
    conversations.some(
      (row: Readonly<Pick<ConversationRow, "state">>) =>
        row.state === "deleting" || row.state === "deleted"
    )
  ) {
    return undefined;
  }
  return eveResponseGroupResult.parse({
    candidates: group.candidates.map(
      (
        candidate: ReadonlyNativeSurface<
          NonNullable<ResponseGroupRow["candidates"]>[number]
        >
      ) => {
        const identity = {
          modelId: candidate.modelId,
          operationId: candidate.operationId,
        };
        const row = conversations.find(
          (conversation: Readonly<Pick<ConversationRow, "operationId">>) =>
            conversation.operationId === candidate.operationId
        );
        if (row?.state === "bound" && isNonemptyString(row.sessionId)) {
          return {
            ...identity,
            conversationId: row.id,
            sessionId: row.sessionId,
            state: "bound",
          };
        }
        if (row) {
          return {
            ...identity,
            state:
              row.state === "creating" &&
              row.sessionId === null &&
              !row.dispatched
                ? "waiting"
                : "unresolved",
          };
        }

        if (candidate.rejection) {
          return { ...identity, state: "rejected", ...candidate.rejection };
        }
        return { ...identity, state: "waiting" };
      }
    ),
    id: group.id,
  });
};

const getEveResponseGroupForConversation = async (
  ownerId: string,
  conversationId: string
): Promise<z.output<typeof eveResponseGroupResult> | undefined> => {
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
  if (!hasQueryRow(conversation)) {
    return undefined;
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
  const boundFamily = family.flatMap(
    (member: ReadonlyNativeSurface<(typeof family)[number]>) => {
      if (isNonemptyString(member.sessionId)) {
        return [{ ...member, sessionId: member.sessionId }];
      }
      return [];
    }
  );
  if (boundFamily.length === EMPTY_FAMILY_SIZE) {
    return undefined;
  }
  const operationIds = sql`ARRAY[${sql.join(
    boundFamily.map(
      (member: ReadonlyNativeSurface<(typeof boundFamily)[number]>) =>
        sql`${member.operationId}::uuid`
    ),
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
            boundFamily.map(
              (member: ReadonlyNativeSurface<(typeof boundFamily)[number]>) =>
                member.id
            )
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
    return undefined;
  }
  const lineageGroup = groups.find(
    (group: ReadonlyNativeSurface<(typeof groups)[number]>) =>
      group.id === lineage.groupId
  );
  if (!lineageGroup) {
    return undefined;
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
        (candidate: Readonly<(typeof candidateConversations)[number]>) =>
          candidate.rootConversationId ?? candidate.id
      )
    ),
  ];
  if (candidateRootIds.length === EMPTY_FAMILY_SIZE) {
    return undefined;
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
  const boundGroupFamilies = groupFamilies.flatMap(
    (member: ReadonlyNativeSurface<(typeof groupFamilies)[number]>) => {
      if (isNonemptyString(member.sessionId)) {
        return [{ ...member, sessionId: member.sessionId }];
      }
      return [];
    }
  );
  const groupLineage = resolveEveResponseGroupLineage(
    conversationId,
    boundGroupFamilies,
    [lineageGroup]
  );
  if (!groupLineage) {
    return undefined;
  }
  const group = await getEveResponseGroup(ownerId, lineage.groupId);
  if (!group) {
    return undefined;
  }
  return eveResponseGroupResult.parse({
    ...group,
    candidates: group.candidates.map(
      (
        candidate: ReadonlyNativeSurface<
          z.output<typeof eveResponseGroupResult>["candidates"][number]
        >
      ) => {
        const replacement = groupLineage.replacements.get(
          candidate.operationId
        );

        if (candidate.state === "bound" && replacement) {
          return { ...candidate, ...replacement };
        }
        return candidate;
      }
    ),
  });
};

export {
  getEveResponseGroup,
  getEveResponseGroupForConversation,
  recordEveResponseGroupRejection,
  reserveEveResponseGroup,
  reserveEveResponseGroupInTransaction,
  tombstoneEveResponseGroups,
};
