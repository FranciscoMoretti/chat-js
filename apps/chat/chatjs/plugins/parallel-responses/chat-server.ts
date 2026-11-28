import { and, eq, sql } from "drizzle-orm";
import type { ChatServerIntegration } from "@/chatjs/core/chat/contracts";
import { CreationConflictError } from "@/lib/db/creation-conflict-error";
import { db } from "@/lib/db/client";
import {
  hasRetiredGroupMember,
  tombstoneEveResponseGroups,
} from "./response-group-queries";
import { eveResponseGroup } from "./response-group-schema";

const parallelResponsesChat = {
  resolveCreationChatId: async (tx, ownerId, operationId) => {
    const [group] = await tx
      .select({
        id: eveResponseGroup.id,
        deleted: eveResponseGroup.deleted,
        retired: hasRetiredGroupMember,
        sourceBranchId: eveResponseGroup.sourceBranchId,
      })
      .from(eveResponseGroup)
      .where(
        and(
          eq(eveResponseGroup.ownerId, ownerId),
          sql`${operationId}::uuid = ANY(${eveResponseGroup.candidateOperationIds})`
        )
      );
    if (group?.deleted || group?.retired) {
      throw new CreationConflictError("This response group has been deleted.");
    }
    return group?.sourceBranchId === null ? group.id : undefined;
  },
  onFenceConversations: tombstoneEveResponseGroups,
  branchGroups: async (ownerId, operationIds) => {
    if (operationIds.length === 0) {
      return [];
    }
    const ids = sql`ARRAY[${sql.join(
      operationIds.map((id) => sql`${id}::uuid`),
      sql`, `
    )}]`;
    const groups = await db
      .select({
        id: eveResponseGroup.id,
        candidates: eveResponseGroup.candidates,
        candidateOperationIds: eveResponseGroup.candidateOperationIds,
      })
      .from(eveResponseGroup)
      .where(
        and(
          eq(eveResponseGroup.ownerId, ownerId),
          eq(eveResponseGroup.deleted, false),
          sql`not ${hasRetiredGroupMember}`,
          sql`${eveResponseGroup.candidateOperationIds} && ${ids}`
        )
      );
    const visibleOperations = new Set(operationIds);
    return groups.map((group) => ({
      id: group.id,
      operationIds: group.candidateOperationIds.filter((id) =>
        visibleOperations.has(id)
      ),
      details: { kind: "parallel-responses", candidates: group.candidates },
    }));
  },
} satisfies ChatServerIntegration;

export default parallelResponsesChat;
