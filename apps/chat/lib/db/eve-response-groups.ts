/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash } from "node:crypto";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
/* oxlint-enable sort-imports */
import type { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { eveResponseGroupCandidates } from "@/lib/eve/response-group-candidates";
/* oxlint-enable sort-imports */
import { eveResponseGroupResult } from "@/lib/eve/response-group-contracts";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveResponseGroupInput } from "@/lib/eve/response-group-input";
/* oxlint-enable sort-imports */
import { resolveEveResponseGroupLineage } from "@/lib/eve/response-group-lineage";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */

import { db } from "./client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, eveResponseGroup } from "./schema";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

const FIRST_PARAMETER_INDEX = 0;
const EMPTY_FAMILY_SIZE = 0;
const SINGLE_MATCH_LIMIT = 1;

type ResponseGroupTransaction = Parameters<
  Parameters<typeof db.transaction>[typeof FIRST_PARAMETER_INDEX]
>[typeof FIRST_PARAMETER_INDEX];
type ResponseGroupRow = typeof eveResponseGroup.$inferSelect;
type ConversationRow = typeof eveConversation.$inferSelect;
type ReservedResponseGroup = Omit<
  ResponseGroupRow,
  "candidates" | "inputHash"
> & {
  candidates: NonNullable<ResponseGroupRow["candidates"]>;
  inputHash: string;
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reserveGroupRow's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * max-lines-per-function (#510): reserveGroupRow keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): reserveGroupRow keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): reserveGroupRow accepts tx: ResponseGroupTransaction; value: z.infer<typeof eveResponseGroupInput>; candidate; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): reserveGroupRow intentionally keeps the existing falsy-value behavior of existing; sourceId; source; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): reserveGroupRow preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const reserveGroupRow = async (
  tx: ResponseGroupTransaction,
  ownerId: string,
  value: z.infer<typeof eveResponseGroupInput>
): Promise<ResponseGroupRow | undefined> => {
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading deleted from existing; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (existing?.deleted) {
    throw new Error("This response group has been deleted.");
  }
  if (existing && existing.inputHash !== inputHash) {
    throw new Error(
      "This response group already has a different message, model order, tool selection, or source."
    );
  }
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading conversationId from input.fork; preserve one receiver evaluation, skipped accesses and the existing null fallback. The app guidance prefers optional chaining.
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
    // oxlint-disable-next-line typescript/consistent-return -- #580: reserveGroupRow has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
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
  // oxlint-disable-next-line typescript/consistent-return -- #580: reserveGroupRow has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return group;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * typescript/prefer-readonly-parameter-types (#565): requireGroup accepts result: Awaited<ReturnType<typeof reserveGroupRow>>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): requireGroup intentionally keeps the existing falsy-value behavior of result.inputHash; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const requireGroup = (
  result: Awaited<ReturnType<typeof reserveGroupRow>>
): ReservedResponseGroup => {
  if (!result) {
    throw new Error("Source conversation is unavailable.");
  }
  if (!(result.candidates && result.inputHash)) {
    throw new Error("Response group content is unavailable.");
  }
  return {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing result own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...result,
    candidates: result.candidates,
    inputHash: result.inputHash,
  };
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reserveEveResponseGroup's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/promise-function-async --typescript/prefer-readonly-parameter-types (#565): reserveEveResponseGroup accepts value: z.infer<typeof eveResponseGroupInput>; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/promise-function-async (#606): reserveEveResponseGroup preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
/**
 * Reserve every candidate under the same owner lock used by family deletion.
 * @param {string} ownerId Owner whose family lock fences the comparison reservation.
 * @param {z.infer<typeof eveResponseGroupInput>} value Comparison input whose complete content hash and ordered candidates define replay identity.
 * @returns {Promise<ReservedResponseGroup>} The allocated or replayed group with available candidate content, after committing its reservation.
 */
const reserveEveResponseGroup = async (
  ownerId: string,
  value: z.infer<typeof eveResponseGroupInput>
): Promise<ReservedResponseGroup> => {
  const result = await db.transaction((tx) =>
    reserveGroupRow(tx, ownerId, value)
  );
  return requireGroup(result);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reserveEveResponseGroupInTransaction's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable typescript/prefer-readonly-parameter-types --typescript/prefer-readonly-parameter-types (#565): reserveEveResponseGroupInTransaction accepts tx: ResponseGroupTransaction; value: z.infer<typeof eveResponseGroupInput>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Must commit with guest quota when admitting an anonymous comparison.
 * @param {ResponseGroupTransaction} tx Native transaction shared with the caller's guest quota admission.
 * @param {string} ownerId Owner whose family lock fences the comparison reservation.
 * @param {z.infer<typeof eveResponseGroupInput>} value Comparison input whose hash and candidate order define replay identity.
 * @returns {Promise<ReservedResponseGroup>} The allocated or replayed group; the caller controls the shared transaction commit.
 */
const reserveEveResponseGroupInTransaction = async (
  tx: ResponseGroupTransaction,
  ownerId: string,
  value: z.infer<typeof eveResponseGroupInput>
): Promise<ReservedResponseGroup> =>
  requireGroup(await reserveGroupRow(tx, ownerId, value));
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve tombstoneEveResponseGroups's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null --typescript/prefer-readonly-parameter-types (#565): tombstoneEveResponseGroups accepts tx: ResponseGroupTransaction; family: { id: string; operationId: string; }[]; row; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): tombstoneEveResponseGroups intentionally keeps the existing falsy-value behavior of unknown; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/max-nested-calls (#568): tombstoneEveResponseGroups keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
unicorn/no-null (#570): tombstoneEveResponseGroups preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/**
 * Caller holds the owner family lock; retain identities but erase request metadata.
 * @param {ResponseGroupTransaction} tx Native deletion transaction already holding the owner family lock.
 * @param {string} ownerId Owner whose source and candidate groups are tombstoned.
 * @param {{ id: string; operationId: string; }[]} family Conversation and operation identities defining the deleted family.
 */
const tombstoneEveResponseGroups = async (
  tx: ResponseGroupTransaction,
  ownerId: string,
  family: {
    id: string;
    operationId: string;
  }[]
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve recordEveResponseGroupRejection's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable max-params, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --max-params (#511): recordEveResponseGroupRejection keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): recordEveResponseGroupRejection accepts rejection?: { error: string; code?: "project_not_found"; }; tx; candidate; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): recordEveResponseGroupRejection intentionally keeps the existing falsy-value behavior of group?.candidates?.some( (candidate) => candidate.operationId === operationId ); distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/**
 * Clear an old rejection before retry; only a definitive result may replace it.
 * @param {string} ownerId Owner whose family lock serializes the candidate update.
 * @param {string} groupId Live response group containing the candidate operation.
 * @param {string} operationId Exact candidate operation whose rejection is replaced or cleared.
 * @param {{ error: string; code?: "project_not_found"; } | undefined} rejection Definitive rejection details; absence clears the prior rejection for retry.
 */
const recordEveResponseGroupRejection = async (
  ownerId: string,
  groupId: string,
  operationId: string,
  rejection?: {
    error: string;
    code?: "project_not_found";
  }
): Promise<void> => {
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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading some from group.candidates; read candidates from group; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      !group?.candidates?.some(
        (candidate) => candidate.operationId === operationId
      )
    ) {
      throw new Error("Response group is unavailable.");
    }
    // oxlint-disable-next-line oxc/no-map-spread -- #541: Build updated candidate snapshots without mutating the loaded response-group record.
    const candidates = group.candidates.map((candidate) => {
      if (candidate.operationId === operationId) {
        return {
          modelId: candidate.modelId,
          operationId,
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Conditional spread (rejection ? { rejection } : {}) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
          ...(rejection ? { rejection } : {}),
        };
      }
      return candidate;
    });
    await tx.update(eveResponseGroup).set({ candidates }).where(condition);
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEveResponseGroup's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-params, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, typescript/strict-boolean-expressions --max-lines-per-function (#510): getEveResponseGroup keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/strict-boolean-expressions (#610): getEveResponseGroup intentionally keeps the existing falsy-value behavior of row.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading candidates from group; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
      (row: Readonly<Pick<ConversationRow, "state">>) =>
        row.state === "deleting" || row.state === "deleted"
    )
  ) {
    return;
  }
  // oxlint-disable-next-line typescript/consistent-return -- #580: getEveResponseGroup has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
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
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading state from row; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        if (row?.state === "bound" && row.sessionId) {
          return {
            // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing identity own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
            ...identity,
            conversationId: row.id,
            sessionId: row.sessionId,
            state: "bound",
          };
        }
        if (row) {
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing identity own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          return { ...identity, state: "unresolved" };
        }

        if (candidate.rejection) {
          return (
            // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing identity own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing candidate.rejection own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
            { ...identity, state: "rejected", ...candidate.rejection }
          );
        }
        return (
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing identity own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          { ...identity, state: "waiting" }
        );
      }
    ),
    id: group.id,
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEveResponseGroupForConversation's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-statements, typescript/strict-boolean-expressions, unicorn/max-nested-calls -- max-lines-per-function (#510): getEveResponseGroupForConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): getEveResponseGroupForConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/strict-boolean-expressions (#610): getEveResponseGroupForConversation intentionally keeps the existing falsy-value behavior of conversation; member.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/max-nested-calls (#568): getEveResponseGroupForConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
  const boundFamily = family.flatMap(
    (member: ReadonlyNativeSurface<(typeof family)[number]>) => {
      if (member.sessionId) {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing member own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        return [{ ...member, sessionId: member.sessionId }];
      }
      return [];
    }
  );
  if (boundFamily.length === EMPTY_FAMILY_SIZE) {
    return;
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
    return;
  }
  const lineageGroup = groups.find(
    (group: ReadonlyNativeSurface<(typeof groups)[number]>) =>
      group.id === lineage.groupId
  );
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
        (candidate: Readonly<(typeof candidateConversations)[number]>) =>
          candidate.rootConversationId ?? candidate.id
      )
    ),
  ];
  if (candidateRootIds.length === EMPTY_FAMILY_SIZE) {
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
  const boundGroupFamilies = groupFamilies.flatMap(
    (member: ReadonlyNativeSurface<(typeof groupFamilies)[number]>) => {
      if (member.sessionId) {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing member own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
    return;
  }
  const group = await getEveResponseGroup(ownerId, lineage.groupId);
  if (!group) {
    return;
  }
  // oxlint-disable-next-line typescript/consistent-return -- #580: getEveResponseGroupForConversation has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return eveResponseGroupResult.parse({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing group own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...group,
    // oxlint-disable-next-line oxc/no-map-spread -- #541: Build updated candidate snapshots without mutating the loaded response-group record.
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
          return (
            // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing candidate own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing replacement own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
            { ...candidate, ...replacement }
          );
        }
        return candidate;
      }
    ),
  });
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getEveResponseGroup, getEveResponseGroupForConversation, recordEveResponseGroupRejection, reserveEveResponseGroup, reserveEveResponseGroupInTransaction, tombstoneEveResponseGroups); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, typescript/strict-boolean-expressions, unicorn/max-nested-calls */

/* oxlint-disable max-lines -- #509: This eve-response-groups.ts module keeps its existing API and workflow boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric.
 */
export {
  getEveResponseGroup,
  getEveResponseGroupForConversation,
  recordEveResponseGroupRejection,
  reserveEveResponseGroup,
  reserveEveResponseGroupInTransaction,
  tombstoneEveResponseGroups,
};
/* oxlint-enable import/no-named-export */
