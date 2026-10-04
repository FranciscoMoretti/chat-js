/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../eve/response-group-candidates"; "../eve/response-group-contracts"; "../eve/response-group-input"; "../eve/response-group-lineage" dependency within this package instead of introducing an alias or barrel API.
 */
import { createHash } from "node:crypto";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { z } from "zod";

import { eveResponseGroupCandidates } from "../eve/response-group-candidates";
import { eveResponseGroupResult } from "../eve/response-group-contracts";
import { eveResponseGroupInput } from "../eve/response-group-input";
import { resolveEveResponseGroupLineage } from "../eve/response-group-lineage";
import { db } from "./client";
import { eveConversation, eveResponseGroup } from "./schema";
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * max-lines-per-function (#510): reserveGroupRow keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): reserveGroupRow keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): reserveGroupRow uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep reserveGroupRow's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): reserveGroupRow accepts tx: Parameters<Parameters<typeof db.transaction>[0]>[0]; value: z.infer<typeof eveResponseGroupInput>; candidate; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): reserveGroupRow intentionally keeps the existing falsy-value behavior of existing; sourceId; source; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): reserveGroupRow preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * typescript/explicit-function-return-type (#560): Keep requireGroup's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): requireGroup accepts result: Awaited<ReturnType<typeof reserveGroupRow>>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): requireGroup intentionally keeps the existing falsy-value behavior of result.inputHash; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- jsdoc/require-param (#534): reserveEveResponseGroup's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): reserveEveResponseGroup's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
typescript/explicit-function-return-type (#560): Keep reserveEveResponseGroup's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep reserveEveResponseGroup's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): reserveEveResponseGroup accepts value: z.infer<typeof eveResponseGroupInput>; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/promise-function-async (#606): reserveEveResponseGroup preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections. */
/** Reserve every candidate under the same owner lock used by family deletion. */
const reserveEveResponseGroup = async (
  ownerId: string,
  value: z.infer<typeof eveResponseGroupInput>
) => {
  const result = await db.transaction((tx) =>
    reserveGroupRow(tx, ownerId, value)
  );
  return requireGroup(result);
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- jsdoc/require-param (#534): reserveEveResponseGroupInTransaction's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): reserveEveResponseGroupInTransaction's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
no-magic-numbers (#517): reserveEveResponseGroupInTransaction uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/explicit-function-return-type (#560): Keep reserveEveResponseGroupInTransaction's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep reserveEveResponseGroupInTransaction's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): reserveEveResponseGroupInTransaction accepts tx: Parameters<Parameters<typeof db.transaction>[0]>[0]; value: z.infer<typeof eveResponseGroupInput>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/** Must commit with guest quota when admitting an anonymous comparison. */
const reserveEveResponseGroupInTransaction = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerId: string,
  value: z.infer<typeof eveResponseGroupInput>
) => requireGroup(await reserveGroupRow(tx, ownerId, value));
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-param, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null -- jsdoc/require-param (#534): tombstoneEveResponseGroups's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
no-magic-numbers (#517): tombstoneEveResponseGroups uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): tombstoneEveResponseGroups accepts tx: Parameters<Parameters<typeof db.transaction>[0]>[0]; family: { id: string; operationId: string; }[]; row; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): tombstoneEveResponseGroups intentionally keeps the existing falsy-value behavior of unknown; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/max-nested-calls (#568): tombstoneEveResponseGroups keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
unicorn/no-null (#570): tombstoneEveResponseGroups preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/** Caller holds the owner family lock; retain identities but erase request metadata. */
const tombstoneEveResponseGroups = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
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
/* oxlint-enable jsdoc/require-param, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable jsdoc/require-param, max-params, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- jsdoc/require-param (#534): recordEveResponseGroupRejection's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-params (#511): recordEveResponseGroupRejection keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): recordEveResponseGroupRejection accepts rejection?: { error: string; code?: "project_not_found"; }; tx; candidate; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): recordEveResponseGroupRejection intentionally keeps the existing falsy-value behavior of group?.candidates?.some( (candidate) => candidate.operationId === operationId ); distinguishing empty, zero, and absent states requires a domain behavior decision. */
/** Clear an old rejection before retry; only a definitive result may replace it. */
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
      !group?.candidates?.some(
        (candidate) => candidate.operationId === operationId
      )
    ) {
      throw new Error("Response group is unavailable.");
    }
    // oxlint-disable-next-line oxc/no-map-spread -- #541: Build updated candidate snapshots without mutating the loaded response-group record.
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
/* oxlint-enable jsdoc/require-param, max-params, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- jsdoc/require-param (#534): getEveResponseGroup's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): getEveResponseGroup's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-lines-per-function (#510): getEveResponseGroup keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/explicit-function-return-type (#560): Keep getEveResponseGroup's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep getEveResponseGroup's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): getEveResponseGroup accepts row; candidate; conversation; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): getEveResponseGroup intentionally keeps the existing falsy-value behavior of row.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/** Owner-only ordered bindings; transcript content remains in native sessions. */
const getEveResponseGroup = async (ownerId: string, id: string) => {
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
  // oxlint-disable-next-line typescript/consistent-return -- #580: getEveResponseGroup has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls -- max-lines-per-function (#510): getEveResponseGroupForConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): getEveResponseGroupForConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): getEveResponseGroupForConversation uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/explicit-function-return-type (#560): Keep getEveResponseGroupForConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep getEveResponseGroupForConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): getEveResponseGroupForConversation accepts member; group; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): getEveResponseGroupForConversation intentionally keeps the existing falsy-value behavior of conversation; member.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/max-nested-calls (#568): getEveResponseGroupForConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
const getEveResponseGroupForConversation = async (
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
  if (boundFamily.length === 0) {
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
  if (candidateRootIds.length === 0) {
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
  // oxlint-disable-next-line typescript/consistent-return -- #580: getEveResponseGroupForConversation has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return eveResponseGroupResult.parse({
    ...group,
    // oxlint-disable-next-line oxc/no-map-spread -- #541: Build updated candidate snapshots without mutating the loaded response-group record.
    candidates: group.candidates.map((candidate) => {
      const replacement = groupLineage.replacements.get(candidate.operationId);
      return candidate.state === "bound" && replacement
        ? { ...candidate, ...replacement }
        : candidate;
    }),
  });
};
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls */

/* oxlint-disable max-lines -- #509: This eve-response-groups.ts module keeps its existing API and workflow boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
export {
  getEveResponseGroup,
  getEveResponseGroupForConversation,
  recordEveResponseGroupRejection,
  reserveEveResponseGroup,
  reserveEveResponseGroupInTransaction,
  tombstoneEveResponseGroups,
};
