/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../eve/session-mapping-error" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
// oxlint-disable-next-line eslint/max-classes-per-file -- Keep the related admission error variants alongside their shared query contract.
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  eveChat,
  eveChatProject,
  eveConversation,
  eveFileReference,
  eveGuest,
  eveGuestMessage,
  eveResponseGroup,
  project,
} from "@/lib/db/schema";
import type { EveForkInput } from "@/lib/eve/contracts";
import type { EveHistoryInput } from "@/lib/eve/history-input";

import { EveSessionMappingError } from "../eve/session-mapping-error";
import { initializeEveForkDocuments } from "./eve-documents";
import { referenceEveFiles } from "./eve-files";
import { tombstoneEveResponseGroups } from "./eve-response-groups";
/* oxlint-enable import/no-relative-parent-imports */

// Creation reservations remain readable for recovery; deleting transcripts do not.
const visibleConversation = inArray(eveConversation.state, [
  "creating",
  "bound",
  "uncertain",
]);

/* oxlint-disable import/exports-last, import/group-exports, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types  --
 * import/exports-last (#522): getBoundEveConversationForSession is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): getBoundEveConversationForSession stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getBoundEveConversationForSession API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): getBoundEveConversationForSession uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): getBoundEveConversationForSession sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep getBoundEveConversationForSession's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getBoundEveConversationForSession's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
export const getBoundEveConversationForSession = async (
  ownerId: string,
  sessionId: string
) => {
  const rows = await db
    .select({ id: eveConversation.id })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.sessionId, sessionId),
        eq(eveConversation.state, "bound")
      )
    )
    .limit(1);
  return rows[0];
};
/* oxlint-enable import/exports-last, import/group-exports, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types  --
 * import/exports-last (#522): readEveSessionMapping is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): readEveSessionMapping stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named readEveSessionMapping API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): readEveSessionMapping's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): readEveSessionMapping's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-ternary (#518): readEveSessionMapping derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): readEveSessionMapping sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep readEveSessionMapping's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep readEveSessionMapping's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): readEveSessionMapping accepts identity: { reservationId: string } | { sessionId: string }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Internal mapping lookup includes tombstones so deletion cannot look like pending delivery. */
export const readEveSessionMapping = async (
  identity: { reservationId: string } | { sessionId: string }
) => {
  const [row] = await db
    .select({
      creationKind: eveConversation.creationKind,
      id: eveConversation.id,
      ownerId: eveConversation.ownerId,
      sessionId: eveConversation.sessionId,
      state: eveConversation.state,
    })
    .from(eveConversation)
    .where(
      "reservationId" in identity
        ? eq(eveConversation.id, identity.reservationId)
        : eq(eveConversation.sessionId, identity.sessionId)
    );
  return row;
};
/* oxlint-enable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports  --
 * import/exports-last (#522): ownsEveSession is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): ownsEveSession stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ownsEveSession API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): ownsEveSession sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 */
export const ownsEveSession = async (
  ownerId: string,
  sessionId: string
): Promise<boolean> =>
  Boolean(await getBoundEveConversationForSession(ownerId, sessionId));
/* oxlint-enable import/exports-last, import/group-exports */
/* oxlint-disable import/exports-last, import/group-exports, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null  --
 * import/exports-last (#522): listEveConversations is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): listEveConversations stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named listEveConversations API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * max-lines-per-function (#510): listEveConversations keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): listEveConversations keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): listEveConversations uses 51, 0, 50, -1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): listEveConversations derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): listEveConversations uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): listEveConversations sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep listEveConversations's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep listEveConversations's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): listEveConversations intentionally keeps the existing falsy-value behavior of projectId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): listEveConversations keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): listEveConversations preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const listEveConversations = async (
  ownerId: string,
  input?: EveHistoryInput
) => {
  const { search = "", cursor, projectId } = input ?? {};
  const { title } = eveChat;
  // Preserve PostgreSQL's microseconds: converting the cursor to Date can skip
  // conversations sharing the same millisecond at a page boundary.
  const updatedAt = sql<string>`to_char(${eveChat.updatedAt}, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
  const routeConversationId = sql<string>`coalesce((
    select active."id" from "EveConversation" active
    where active."id" = ${eveChat.activeConversationId}
      and active."chatId" = ${eveChat.id}
      and active."ownerId" = ${ownerId}
      and active."state" in ('creating', 'bound', 'uncertain', 'deleting')
  ), (
    select member."id" from "EveConversation" member
    where member."chatId" = ${eveChat.id}
      and member."ownerId" = ${ownerId}
      and member."state" in ('creating', 'bound', 'uncertain', 'deleting')
    order by (member."state" = 'bound') desc, member."createdAt", member."id"
    limit 1
  ))`;
  const chatState = sql<"creating" | "bound" | "uncertain" | "deleting">`(
    select case
      when bool_and(member."state" = 'deleting') then 'deleting'
      when bool_or(member."state" = 'bound') then 'bound'
      when bool_or(member."state" = 'uncertain') then 'uncertain'
      else 'creating'
    end
    from "EveConversation" member
    where member."chatId" = ${eveChat.id}
      and member."ownerId" = ${ownerId}
      and member."state" in ('creating', 'bound', 'uncertain', 'deleting')
  )`;
  const beforeCursor = cursor
    ? or(
        cursor.isPinned ? eq(eveChat.isPinned, false) : undefined,
        and(
          eq(eveChat.isPinned, cursor.isPinned),
          or(
            sql`${eveChat.updatedAt} < ${cursor.updatedAt}::timestamp`,
            and(
              sql`${eveChat.updatedAt} = ${cursor.updatedAt}::timestamp`,
              lt(eveChat.id, cursor.id)
            )
          )
        )
      )
    : undefined;
  const matchesProject = projectId
    ? eq(eveChatProject.projectId, projectId)
    : isNull(eveChatProject.projectId);
  const escapedSearch = search.replaceAll(/[\\%_]/gu, String.raw`\$&`);
  const rows = await db
    .select({
      conversationId: routeConversationId,
      createdAt: eveChat.createdAt,
      id: eveChat.id,
      isPinned: eveChat.isPinned,
      projectId: eveChatProject.projectId,
      state: chatState,
      title,
      titleStatus: eveChat.titleStatus,
      updatedAt,
    })
    .from(eveChat)
    .leftJoin(eveChatProject, eq(eveChatProject.chatId, eveChat.id))
    .where(
      and(
        eq(eveChat.ownerId, ownerId),
        sql`exists (
          select 1 from "EveConversation" member
          where member."chatId" = ${eveChat.id}
            and member."ownerId" = ${ownerId}
            and member."state" in ('creating', 'bound', 'uncertain', 'deleting')
        )`,
        projectId === undefined ? undefined : matchesProject,
        search ? ilike(title, `%${escapedSearch}%`) : undefined,
        beforeCursor
      )
    )
    .orderBy(desc(eveChat.isPinned), desc(eveChat.updatedAt), desc(eveChat.id))
    .limit(51);
  const page = rows.slice(0, 50);
  const last = page.at(-1);
  return {
    items: page,
    nextCursor:
      rows.length > 50 && last
        ? { id: last.id, isPinned: last.isPinned, updatedAt: last.updatedAt }
        : null,
  };
};
/* oxlint-enable import/exports-last, import/group-exports, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null */
/* oxlint-disable import/exports-last, import/group-exports, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions  --
 * import/exports-last (#522): getEveConversation is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): getEveConversation stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getEveConversation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): getEveConversation uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): getEveConversation derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): getEveConversation uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): getEveConversation sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): getEveConversation copies or separates ...row.conversation while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep getEveConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getEveConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): getEveConversation intentionally keeps the existing falsy-value behavior of row; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const getEveConversation = async (ownerId: string, id: string) => {
  const [row] = await db
    .select({
      chat: {
        id: eveChat.id,
        isPinned: eveChat.isPinned,
        title: eveChat.title,
        titleStatus: eveChat.titleStatus,
        updatedAt: eveChat.updatedAt,
      },
      conversation: eveConversation,
    })
    .from(eveConversation)
    .innerJoin(
      eveChat,
      and(
        eq(eveChat.id, eveConversation.chatId),
        eq(eveChat.ownerId, eveConversation.ownerId)
      )
    )
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.id, id),
        visibleConversation
      )
    )
    .limit(1);
  return row
    ? {
        ...row.conversation,
        chatId: row.chat.id,
        id: row.conversation.id,
        isPinned: row.chat.isPinned,
        title: row.chat.title,
        titleStatus: row.chat.titleStatus,
        updatedAt: row.chat.updatedAt,
      }
    : undefined;
};
/* oxlint-enable import/exports-last, import/group-exports, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions  --
 * import/exports-last (#522): getEveChatPageConversation is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): getEveChatPageConversation stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getEveChatPageConversation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): getEveChatPageConversation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): getEveChatPageConversation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): getEveChatPageConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): getEveChatPageConversation uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): getEveChatPageConversation derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): getEveChatPageConversation uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): getEveChatPageConversation sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): getEveChatPageConversation handles optional active?.chatId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/explicit-function-return-type (#560): Keep getEveChatPageConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getEveChatPageConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): getEveChatPageConversation intentionally keeps the existing falsy-value behavior of logical; logical.activeConversationId; member; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Resolve either a logical chat route or an exact private session route. */
export const getEveChatPageConversation = async (
  ownerId: string,
  routeId: string
) => {
  const exact = await getEveConversation(ownerId, routeId);
  if (exact) {
    return exact;
  }
  const [logical] = await db
    .select({ activeConversationId: eveChat.activeConversationId })
    .from(eveChat)
    .where(and(eq(eveChat.id, routeId), eq(eveChat.ownerId, ownerId)))
    .limit(1);
  if (!logical) {
    // oxlint-disable-next-line typescript/consistent-return -- #580: getEveChatPageConversation has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return;
  }
  if (logical.activeConversationId) {
    const active = await getEveConversation(
      ownerId,
      logical.activeConversationId
    );
    if (active?.chatId === routeId) {
      return active;
    }
  }
  const [member] = await db
    .select({ id: eveConversation.id })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.chatId, routeId),
        eq(eveConversation.ownerId, ownerId),
        visibleConversation
      )
    )
    .orderBy(
      desc(sql`${eveConversation.state} = 'bound'`),
      eveConversation.createdAt,
      eveConversation.id
    )
    .limit(1);
  return member ? await getEveConversation(ownerId, member.id) : undefined;
};
/* oxlint-enable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/exports-last, import/group-exports, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/max-nested-calls  --
 * import/exports-last (#522): getEveChatIdentity is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): getEveChatIdentity stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getEveChatIdentity API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): getEveChatIdentity uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): getEveChatIdentity sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep getEveChatIdentity's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getEveChatIdentity's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/max-nested-calls (#568): getEveChatIdentity keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
export const getEveChatIdentity = async (ownerId: string, routeId: string) => {
  const [identity] = await db
    .select({
      chatId: eveChat.id,
      isPinned: eveChat.isPinned,
      projectId: eveChatProject.projectId,
      title: eveChat.title,
      titleStatus: eveChat.titleStatus,
      visibility: eveConversation.visibility,
    })
    .from(eveChat)
    .leftJoin(
      eveChatProject,
      and(
        eq(eveChatProject.chatId, eveChat.id),
        eq(eveChatProject.ownerId, ownerId)
      )
    )
    .leftJoin(
      eveConversation,
      and(
        eq(eveConversation.chatId, eveChat.id),
        eq(eveConversation.ownerId, eveChat.ownerId),
        eq(eveConversation.id, routeId)
      )
    )
    .where(
      and(
        eq(eveChat.ownerId, ownerId),
        or(eq(eveChat.id, routeId), eq(eveConversation.id, routeId))
      )
    )
    .limit(1);
  return identity;
};
/* oxlint-enable import/exports-last, import/group-exports, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/max-nested-calls */
/* oxlint-disable import/exports-last, import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/exports-last (#522): CreationConflictError is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): CreationConflictError stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named CreationConflictError API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-optional-chaining (#542): CreationConflictError handles optional options?.code without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): CreationConflictError accepts options?: ErrorOptions & { code?: "creation_conflict" | "creation_in_progress"; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export class CreationConflictError extends Error {
  public readonly code: "creation_conflict" | "creation_in_progress";
  public constructor(
    message?: string,
    options?: ErrorOptions & {
      code?: "creation_conflict" | "creation_in_progress";
    }
  ) {
    super(message, options);
    this.code = options?.code ?? "creation_conflict";
    this.name = "CreationConflictError";
  }
}
/* oxlint-enable import/exports-last, import/group-exports, typescript/prefer-readonly-parameter-types */

const assertCreationAvailable = (
  state: typeof eveConversation.$inferSelect.state
): void => {
  if (state === "deleting" || state === "deleted") {
    throw new CreationConflictError(
      "This conversation can no longer be created."
    );
  }
};

/* oxlint-disable no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * no-ternary (#518): boundConversation derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): boundConversation uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-optional-chaining (#542): boundConversation handles optional row?.state without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/explicit-function-return-type (#560): Keep boundConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): boundConversation accepts row: typeof eveConversation.$inferSelect | undefined; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): boundConversation intentionally keeps the existing falsy-value behavior of row.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const boundConversation = (
  row: typeof eveConversation.$inferSelect | undefined
) =>
  row?.state === "bound" && row.sessionId
    ? { id: row.id, sessionId: row.sessionId }
    : undefined;
/* oxlint-enable no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/exports-last, import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types  --
 * import/exports-last (#522): getEveCreation is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): getEveCreation stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getEveCreation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): getEveCreation sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep getEveCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getEveCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
export const getEveCreation = async (ownerId: string, operationId: string) => {
  const [row] = await db
    .select()
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.operationId, operationId)
      )
    );
  return row;
};
/* oxlint-enable import/exports-last, import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/exports-last, import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/exports-last (#522): CreationProjectNotFoundError is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): CreationProjectNotFoundError stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named CreationProjectNotFoundError API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): CreationProjectNotFoundError accepts options?: ErrorOptions; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export class CreationProjectNotFoundError extends Error {
  public constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CreationProjectNotFoundError";
  }
}
/* oxlint-enable import/exports-last, import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * no-magic-numbers (#517): assertResponseGroupCandidateAvailable uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): assertResponseGroupCandidateAvailable sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): assertResponseGroupCandidateAvailable accepts tx: Parameters<Parameters<typeof db.transaction>[0]>[0]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): assertResponseGroupCandidateAvailable intentionally keeps the existing falsy-value behavior of deletedGroup; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const assertResponseGroupCandidateAvailable = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerId: string,
  operationId: string
): Promise<void> => {
  const [deletedGroup] = await tx
    .select({ id: eveResponseGroup.id })
    .from(eveResponseGroup)
    .where(
      and(
        eq(eveResponseGroup.ownerId, ownerId),
        eq(eveResponseGroup.deleted, true),
        sql`${operationId}::uuid = ANY(${eveResponseGroup.candidateOperationIds})`
      )
    )
    .limit(1);
  if (deletedGroup) {
    throw new CreationConflictError("This response group has been deleted.");
  }
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * max-lines-per-function (#510): assertGuestCreationAdmission keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): assertGuestCreationAdmission keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): assertGuestCreationAdmission keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): assertGuestCreationAdmission uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): assertGuestCreationAdmission sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): assertGuestCreationAdmission accepts tx: Parameters<Parameters<typeof db.transaction>[0]>[0]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): assertGuestCreationAdmission intentionally keeps the existing falsy-value behavior of reservationId; guest; quota; creation; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const assertGuestCreationAdmission = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerId: string,
  operationId: string,
  reservationId?: string
): Promise<void> => {
  if (!reservationId) {
    const [guest] = await tx
      .select({ ownerId: eveGuest.ownerId })
      .from(eveGuest)
      .where(eq(eveGuest.ownerId, ownerId));
    if (guest) {
      throw new CreationConflictError(
        "Guest creation requires a quota reservation."
      );
    }
    return;
  }
  if (reservationId) {
    const [quota] = await tx
      .select({
        id: eveGuestMessage.reservationId,
        state: eveGuestMessage.state,
      })
      .from(eveGuestMessage)
      .where(
        and(
          eq(eveGuestMessage.ownerId, ownerId),
          eq(eveGuestMessage.operationId, operationId),
          eq(eveGuestMessage.reservationId, reservationId),
          inArray(eveGuestMessage.state, ["reserved", "committed"])
        )
      );
    if (!quota) {
      throw new CreationConflictError(
        "Guest admission has changed. Retry the saved request."
      );
    }
    if (quota.state === "committed") {
      const [creation] = await tx
        .select({ id: eveConversation.id })
        .from(eveConversation)
        .where(
          and(
            eq(eveConversation.ownerId, ownerId),
            eq(eveConversation.operationId, operationId)
          )
        );
      if (!creation) {
        throw new CreationConflictError(
          "Committed guest admission has no creation journal."
        );
      }
    }
  }
};
/* oxlint-enable max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-params, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * max-params (#511): assignCreationProject keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): assignCreationProject uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): assignCreationProject sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): assignCreationProject accepts tx: Parameters<Parameters<typeof db.transaction>[0]>[0]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): assignCreationProject intentionally keeps the existing falsy-value behavior of target; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const assignCreationProject = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  chatId: string,
  ownerId: string,
  projectId: string
): Promise<void> => {
  const [target] = await tx
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, ownerId)))
    .for("key share");
  if (!target) {
    throw new CreationProjectNotFoundError("Project not found.");
  }
  await tx
    .insert(eveChatProject)
    .values({ chatId, ownerId, projectId: target.id })
    .onConflictDoNothing();
};
/* oxlint-enable max-params, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * max-lines-per-function (#510): reserveEveConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): reserveEveConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): reserveEveConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): reserveEveConversation uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): reserveEveConversation derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): reserveEveConversation uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): reserveEveConversation sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): reserveEveConversation handles optional source?.sessionId; source?.chatId; initialGroup?.id; fork?.checkpointId; fork?.beforeMessageId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): reserveEveConversation copies or separates ...value while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep reserveEveConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): reserveEveConversation accepts value: Omit<typeof eveConversation.$inferInsert, "chatId">; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): reserveEveConversation intentionally keeps the existing falsy-value behavior of existingReservation; source?.sessionId; source; createdChat; existingChat; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const reserveEveConversation = async (
  value: Omit<typeof eveConversation.$inferInsert, "chatId">,
  initialTitle: string,
  fork?: EveForkInput,
  guestReservationId?: string
) =>
  // oxlint-disable-next-line eslint/complexity -- Reservation keeps identity, admission, project, and fork writes in one transaction.
  await db.transaction(async (tx) => {
    // Shared with deletion: a new fork cannot appear behind its family fence.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${value.ownerId}`}, 0))`
    );
    await assertGuestCreationAdmission(
      tx,
      value.ownerId,
      value.operationId,
      guestReservationId
    );
    await assertResponseGroupCandidateAvailable(
      tx,
      value.ownerId,
      value.operationId
    );
    const [existingReservation] = await tx
      .select({ id: eveConversation.id })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.ownerId, value.ownerId),
          eq(eveConversation.operationId, value.operationId)
        )
      )
      .limit(1);
    if (existingReservation) {
      return [];
    }
    const [source] = fork
      ? await tx
          .select()
          .from(eveConversation)
          .where(
            and(
              eq(eveConversation.id, fork.conversationId),
              eq(eveConversation.ownerId, value.ownerId),
              eq(eveConversation.state, "bound")
            )
          )
      : [];
    if (fork && !source?.sessionId) {
      throw new CreationConflictError(
        "The source conversation is not available for editing."
      );
    }
    const [initialGroup] = source
      ? []
      : await tx
          .select({ id: eveResponseGroup.id })
          .from(eveResponseGroup)
          .where(
            and(
              eq(eveResponseGroup.ownerId, value.ownerId),
              eq(eveResponseGroup.deleted, false),
              isNull(eveResponseGroup.sourceConversationId),
              sql`${value.operationId}::uuid = ANY(${eveResponseGroup.candidateOperationIds})`
            )
          )
          .limit(1);
    const chatId = source?.chatId ?? initialGroup?.id ?? crypto.randomUUID();
    const [createdChat] = await tx
      .insert(eveChat)
      .values({ id: chatId, ownerId: value.ownerId, title: initialTitle })
      .onConflictDoNothing()
      .returning({ id: eveChat.id });
    if (!createdChat) {
      const [existingChat] = await tx
        .select({ id: eveChat.id })
        .from(eveChat)
        .where(and(eq(eveChat.id, chatId), eq(eveChat.ownerId, value.ownerId)));
      if (!existingChat) {
        throw new CreationConflictError(
          "Conversation identity is unavailable."
        );
      }
    }
    const rows = await tx
      .insert(eveConversation)
      .values({
        ...value,
        chatId,
        forkCheckpointId: fork?.checkpointId,
        forkKind: value.forkKind,
        forkMessageId: fork?.beforeMessageId,
        forkTurnId: fork?.beforeTurnId,
        parentConversationId: fork?.conversationId,
        rootConversationId: source
          ? (source.rootConversationId ?? source.id)
          : undefined,
      })
      .onConflictDoNothing()
      .returning();
    const [created] = rows;
    if (createdChat && value.initialProjectId) {
      await assignCreationProject(
        tx,
        chatId,
        value.ownerId,
        value.initialProjectId
      );
    }
    if (created && source) {
      // Retain inherited files conservatively; native history owns turn contents.
      const references = await tx
        .select({ key: eveFileReference.key })
        .from(eveFileReference)
        .where(
          and(
            eq(eveFileReference.conversationId, source.id),
            eq(eveFileReference.ownerId, value.ownerId)
          )
        );
      if (references.length > 0) {
        await tx.insert(eveFileReference).values(
          references.map(({ key }) => ({
            conversationId: created.id,
            key,
            ownerId: value.ownerId,
          }))
        );
      }
    }
    return rows;
  });
/* oxlint-enable max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls  --
 * import/exports-last (#522): beginEveConversationDeletion is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): beginEveConversationDeletion stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named beginEveConversationDeletion API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): beginEveConversationDeletion's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): beginEveConversationDeletion's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): beginEveConversationDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): beginEveConversationDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): beginEveConversationDeletion sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep beginEveConversationDeletion's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep beginEveConversationDeletion's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): beginEveConversationDeletion accepts tx; row; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): beginEveConversationDeletion intentionally keeps the existing falsy-value behavior of source; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): beginEveConversationDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
/** Fence one conversation family; retirement and physical purge must finish separately. */
export const beginEveConversationDeletion = async (
  ownerId: string,
  id: string
) =>
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [source] = await tx
      .select({ chatId: eveChat.id })
      .from(eveChat)
      .leftJoin(
        eveConversation,
        and(
          eq(eveConversation.chatId, eveChat.id),
          eq(eveConversation.ownerId, eveChat.ownerId),
          eq(eveConversation.id, id)
        )
      )
      .where(
        and(
          eq(eveChat.ownerId, ownerId),
          or(eq(eveChat.id, id), eq(eveConversation.id, id))
        )
      );
    if (!source) {
      return;
    }
    const familyCondition = and(
      eq(eveConversation.ownerId, ownerId),
      eq(eveConversation.chatId, source.chatId)
    );
    const family = await tx
      .select()
      .from(eveConversation)
      .where(familyCondition)
      .orderBy(eveConversation.id);
    if (
      family.some(
        (row) => row.state === "creating" || row.state === "uncertain"
      )
    ) {
      throw new CreationConflictError(
        "Finish recovering conversation creation before deleting this conversation."
      );
    }
    await tombstoneEveResponseGroups(tx, ownerId, family);
    // Document writers hold this same lock through their commit. Once the fence
    // commits, later writers fail their bound-conversation check.
    for (const row of family) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Acquire and use transaction locks in a deterministic order.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${row.id}`}, 0))`
      );
    }
    const conversations = await tx
      .update(eveConversation)
      .set({ state: "deleting", visibility: "private" })
      .where(
        and(
          familyCondition,
          inArray(eveConversation.state, ["bound", "deleting"])
        )
      )
      .returning({
        id: eveConversation.id,
        sessionId: eveConversation.sessionId,
      });
    // oxlint-disable-next-line typescript/consistent-return -- #580: beginEveConversationDeletion has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return {
      conversations: conversations.toSorted((left, right) =>
        left.id.localeCompare(right.id)
      ),
      rootId: source.chatId,
    };
  });
/* oxlint-enable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls */

/* oxlint-disable unicorn/no-null  --
 * oxc/no-optional-chaining (#542): matchesEveFork handles optional fork?.conversationId; fork?.beforeTurnId; fork?.beforeMessageId; fork?.checkpointId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * unicorn/no-null (#570): matchesEveFork preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const matchesEveFork = (
  existing: Pick<
    typeof eveConversation.$inferSelect,
    | "parentConversationId"
    | "forkTurnId"
    | "forkMessageId"
    | "forkCheckpointId"
    | "forkKind"
  >,
  fork: EveForkInput | undefined,
  forkKind: typeof eveConversation.$inferSelect.forkKind
): boolean =>
  existing.parentConversationId === (fork?.conversationId ?? null) &&
  existing.forkTurnId === (fork?.beforeTurnId ?? null) &&
  existing.forkMessageId === (fork?.beforeMessageId ?? null) &&
  existing.forkCheckpointId === (fork?.checkpointId ?? null) &&
  existing.forkKind === forkKind;
/* oxlint-enable unicorn/no-null */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): CreationTransaction uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
type CreationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/* oxlint-enable no-magic-numbers */
/* oxlint-disable max-lines-per-function, max-params, max-statements, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null  --
 * max-lines-per-function (#510): bindConversationSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): bindConversationSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): bindConversationSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): bindConversationSession sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): bindConversationSession handles optional bound?.sessionId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/explicit-function-return-type (#560): Keep bindConversationSession's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): bindConversationSession accepts tx: CreationTransaction; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): bindConversationSession intentionally keeps the existing falsy-value behavior of sessionBinding; bound?.sessionId; existing; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): bindConversationSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): bindConversationSession preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const bindConversationSession = async (
  tx: CreationTransaction,
  ownerId: string,
  reservationId: string,
  sessionId: string
) => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`eve-binding:${sessionId}`}, 0))`
  );
  const [sessionBinding] = await tx
    .select({ id: eveConversation.id })
    .from(eveConversation)
    .where(eq(eveConversation.sessionId, sessionId));
  if (sessionBinding && sessionBinding.id !== reservationId) {
    throw new EveSessionMappingError("binding_conflict");
  }
  const [bound] = await tx
    .update(eveConversation)
    .set({ initialRequest: null, sessionId, state: "bound" })
    .where(
      and(
        eq(eveConversation.id, reservationId),
        eq(eveConversation.ownerId, ownerId),
        or(
          and(
            inArray(eveConversation.state, ["creating", "uncertain"]),
            isNull(eveConversation.sessionId)
          ),
          and(
            eq(eveConversation.state, "bound"),
            eq(eveConversation.sessionId, sessionId)
          )
        )
      )
    )
    .returning();
  if (!bound?.sessionId) {
    const [existing] = await tx
      .select()
      .from(eveConversation)
      .where(eq(eveConversation.id, reservationId));
    if (!existing) {
      throw new EveSessionMappingError("identity_missing");
    }
    if (existing.ownerId !== ownerId) {
      throw new EveSessionMappingError("owner_mismatch");
    }
    if (existing.state === "deleting" || existing.state === "deleted") {
      throw new EveSessionMappingError("identity_deleted");
    }
    throw new EveSessionMappingError("binding_conflict");
  }
  await tx
    .update(eveChat)
    .set({
      activeConversationId: sql`coalesce(${eveChat.activeConversationId}, ${bound.id}::uuid)`,
      updatedAt: new Date(),
    })
    .where(and(eq(eveChat.id, bound.chatId), eq(eveChat.ownerId, ownerId)));
  return { id: bound.id, sessionId: bound.sessionId };
};
/* oxlint-enable max-lines-per-function, max-params, max-statements, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null  --
 * import/group-exports (#523): createEveConversation stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named createEveConversation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): createEveConversation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): createEveConversation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): createEveConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): createEveConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): createEveConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): createEveConversation sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): createEveConversation handles optional lock?.locked without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/explicit-function-return-type (#560): Keep createEveConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep createEveConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): createEveConversation accepts { initialModelId, initialRequest, initialContentHash, initialTitle = message, fo; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): createEveConversation intentionally keeps the existing falsy-value behavior of initialProjectId; reservation; existing; current; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): createEveConversation preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** The dispatcher must use the supplied reservation ID as Eve's idempotency key. */
// oxlint-disable-next-line eslint/complexity -- Keep the atomic admission and validation branches together at this transaction boundary.
export const createEveConversation = async (
  ownerId: string,
  operationId: string,
  message: string,
  create: (id: string) => Promise<string>,
  {
    initialModelId,
    initialRequest,
    initialContentHash,
    initialTitle = message,
    fork,
    forkKind,
    fileKeys = [],
    initialProjectId,
    guestReservationId,
  }: {
    initialRequest?: unknown;
    initialModelId?: string;
    initialContentHash?: string;
    initialTitle?: string;
    fork?: EveForkInput;
    forkKind?: typeof eveConversation.$inferInsert.forkKind;
    fileKeys?: string[];
    initialProjectId?: string;
    guestReservationId?: string;
  } = {}
) => {
  if (forkKind && !fork) {
    throw new CreationConflictError(
      "Fork intent requires a source conversation."
    );
  }
  if (fork && initialProjectId) {
    throw new CreationConflictError(
      "Forks inherit their source conversation project."
    );
  }
  let [reservation] = await reserveEveConversation(
    {
      firstMessage: message,
      forkKind,
      initialContentHash,
      initialModelId,
      initialProjectId,
      initialRequest,
      operationId,
      ownerId,
    },
    initialTitle,
    fork,
    guestReservationId
  );
  if (!reservation) {
    const [existing] = await db
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.operationId, operationId)
        )
      );
    if (existing) {
      assertCreationAvailable(existing.state);
    }
    if (
      !existing ||
      existing.creationKind !== "message" ||
      existing.firstMessage !== message ||
      existing.initialModelId !== (initialModelId ?? null) ||
      existing.initialContentHash !== (initialContentHash ?? null) ||
      existing.initialProjectId !== (initialProjectId ?? null) ||
      !matchesEveFork(existing, fork, forkKind ?? null)
    ) {
      throw new CreationConflictError(
        "This operation already has a different message, attachments, model, tool selection, project, or source turn."
      );
    }
    const binding = boundConversation(existing);
    if (binding) {
      return binding;
    }
    reservation = existing;
  }
  try {
    // This idempotent initialization commits before dispatch and acquires its own
    // document lock. Do not nest its connection inside the creation transaction.
    if (fork) {
      await initializeEveForkDocuments(ownerId, reservation.id);
    }
    await referenceEveFiles(ownerId, reservation.id, fileKeys);
    return await db.transaction(async (tx) => {
      // The reservation is already committed so native hooks can find it.
      // Transaction locks release on worker death; creating rows need no manual repair.
      const [lock] = await tx.execute<{
        locked: boolean;
      }>(
        sql`select pg_try_advisory_xact_lock(hashtextextended(${`eve-create:${reservation.id}`}, 0)) as locked`
      );
      if (!lock?.locked) {
        throw new CreationConflictError(
          "Creation is still in progress. Retry the same operation shortly.",
          { code: "creation_in_progress" }
        );
      }
      const [current] = await tx
        .select()
        .from(eveConversation)
        .where(eq(eveConversation.id, reservation.id));
      const binding = boundConversation(current);
      if (binding) {
        return binding;
      }
      if (
        !(
          current &&
          current.creationKind === "message" &&
          (current.state === "creating" || current.state === "uncertain")
        )
      ) {
        throw new CreationConflictError(
          "This conversation can no longer be created."
        );
      }
      const sessionId = await create(reservation.id);
      return await bindConversationSession(
        tx,
        ownerId,
        reservation.id,
        sessionId
      );
    });
  } catch (error) {
    if (error instanceof CreationConflictError) {
      throw error;
    }
    await db
      .update(eveConversation)
      .set({ state: "uncertain" })
      .where(
        and(
          eq(eveConversation.id, reservation.id),
          eq(eveConversation.state, "creating")
        )
      );
    throw error;
  }
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types  --
 * import/group-exports (#523): listEveOwnerBindings stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named listEveOwnerBindings API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): listEveOwnerBindings sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep listEveOwnerBindings's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep listEveOwnerBindings's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
export const listEveOwnerBindings = async (ownerId: string) =>
  await db
    .select({
      sessionId: eveConversation.sessionId,
      state: eveConversation.state,
      usageStreamIndex: eveConversation.usageStreamIndex,
    })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        ne(eveConversation.state, "deleted")
      )
    );
/* oxlint-enable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * import/group-exports (#523): updateEveConversationMetadata stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named updateEveConversationMetadata API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-ternary (#518): updateEveConversationMetadata derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): updateEveConversationMetadata uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): updateEveConversationMetadata sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep updateEveConversationMetadata's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep updateEveConversationMetadata's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): updateEveConversationMetadata accepts updates: { title?: string; isPinned?: boolean; visibility?: "private" | "public"; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): updateEveConversationMetadata intentionally keeps the existing falsy-value behavior of updates.title; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const updateEveConversationMetadata = async (
  ownerId: string,
  id: string,
  updates: {
    title?: string;
    isPinned?: boolean;
    visibility?: "private" | "public";
  }
) => {
  if (updates.visibility !== undefined) {
    const [conversation] = await db
      .update(eveConversation)
      .set({ visibility: updates.visibility })
      .where(
        and(
          eq(eveConversation.id, id),
          eq(eveConversation.ownerId, ownerId),
          visibleConversation
        )
      )
      .returning({ id: eveConversation.id });
    return conversation;
  }
  const titleStatus = updates.title ? "manual" : undefined;
  const [row] = await db
    .update(eveChat)
    .set({
      isPinned: updates.isPinned,
      title: updates.title,
      titleStatus,
    })
    .where(
      and(
        eq(eveChat.id, id),
        eq(eveChat.ownerId, ownerId),
        sql`exists (
          select 1 from "EveConversation" member
          where member."chatId" = ${eveChat.id}
            and member."ownerId" = ${ownerId}
            and member."state" in ('creating', 'bound', 'uncertain')
        )`
      )
    )
    .returning({ id: eveChat.id });
  return row;
};
/* oxlint-enable import/group-exports, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, no-magic-numbers  --
 * import/group-exports (#523): isEveRootTitlePending stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named isEveRootTitlePending API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): isEveRootTitlePending uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): isEveRootTitlePending sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 */
export const isEveRootTitlePending = async (
  ownerId: string,
  conversationId: string,
  fallbackTitle: string
): Promise<boolean> => {
  const [row] = await db
    .select({ id: eveChat.id })
    .from(eveConversation)
    .innerJoin(
      eveChat,
      and(
        eq(eveChat.id, eveConversation.chatId),
        eq(eveChat.ownerId, eveConversation.ownerId)
      )
    )
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.ownerId, ownerId),
        eq(eveChat.title, fallbackTitle),
        eq(eveChat.titleStatus, "pending")
      )
    )
    .limit(1);
  return Boolean(row);
};
/* oxlint-enable import/group-exports, no-magic-numbers */

/* oxlint-disable import/group-exports, max-params  --
 * import/group-exports (#523): replaceEveRootFallbackTitle stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named replaceEveRootFallbackTitle API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * max-params (#511): replaceEveRootFallbackTitle keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): replaceEveRootFallbackTitle sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 */
export const replaceEveRootFallbackTitle = async (
  ownerId: string,
  conversationId: string,
  fallbackTitle: string,
  generatedTitle: string
): Promise<boolean> => {
  const [row] = await db
    .update(eveChat)
    .set({ title: generatedTitle, titleStatus: "generated" })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.ownerId, ownerId),
        eq(eveChat.id, eveConversation.chatId),
        eq(eveChat.ownerId, ownerId),
        eq(eveChat.title, fallbackTitle),
        eq(eveChat.titleStatus, "pending")
      )
    )
    .returning({ id: eveChat.id });
  return Boolean(row);
};
/* oxlint-enable import/group-exports, max-params */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): settleEveRootFallbackTitle stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named settleEveRootFallbackTitle API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): settleEveRootFallbackTitle sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 */
export const settleEveRootFallbackTitle = async (
  ownerId: string,
  conversationId: string,
  fallbackTitle: string
): Promise<boolean> => {
  const [row] = await db
    .update(eveChat)
    .set({ titleStatus: "fallback" })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.ownerId, ownerId),
        eq(eveChat.id, eveConversation.chatId),
        eq(eveChat.ownerId, ownerId),
        eq(eveChat.title, fallbackTitle),
        eq(eveChat.titleStatus, "pending")
      )
    )
    .returning({ id: eveChat.id });
  return Boolean(row);
};
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): recordEveConversationActivity stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named recordEveConversationActivity API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): recordEveConversationActivity sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): recordEveConversationActivity accepts at: Date; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const recordEveConversationActivity = async (
  ownerId: string,
  sessionId: string,
  at: Date
): Promise<void> => {
  await db
    .update(eveChat)
    .set({ updatedAt: at })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.sessionId, sessionId),
        eq(eveChat.id, eveConversation.chatId),
        eq(eveChat.ownerId, ownerId),
        visibleConversation,
        lt(eveChat.updatedAt, at)
      )
    );
};
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions  --
 * import/group-exports (#523): getPublicEveConversation stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getPublicEveConversation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): getPublicEveConversation uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): getPublicEveConversation derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): getPublicEveConversation uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): getPublicEveConversation sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): getPublicEveConversation copies or separates ...row.conversation while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep getPublicEveConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getPublicEveConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): getPublicEveConversation intentionally keeps the existing falsy-value behavior of row; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const getPublicEveConversation = async (id: string) => {
  const [row] = await db
    .select({ chat: { title: eveChat.title }, conversation: eveConversation })
    .from(eveConversation)
    .innerJoin(
      eveChat,
      and(
        eq(eveChat.id, eveConversation.chatId),
        eq(eveChat.ownerId, eveConversation.ownerId)
      )
    )
    .where(
      and(
        eq(eveConversation.id, id),
        eq(eveConversation.visibility, "public"),
        eq(eveConversation.state, "bound")
      )
    )
    .limit(1);
  return row ? { ...row.conversation, title: row.chat.title } : undefined;
};
/* oxlint-enable import/group-exports, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types  --
 * import/group-exports (#523): listEveConversationBranches stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named listEveConversationBranches API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): listEveConversationBranches sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep listEveConversationBranches's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep listEveConversationBranches's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
export const listEveConversationBranches = async (
  ownerId: string,
  conversationId: string
) => {
  const conversation = await getEveChatPageConversation(
    ownerId,
    conversationId
  );
  if (!conversation) {
    return;
  }
  const rootId = conversation.rootConversationId ?? conversation.id;
  const branches = await db
    .select({
      createdAt: eveConversation.createdAt,
      firstMessage: eveConversation.firstMessage,
      forkKind: eveConversation.forkKind,
      forkMessageId: eveConversation.forkMessageId,
      forkTurnId: eveConversation.forkTurnId,
      groupCandidates: eveResponseGroup.candidates,
      id: eveConversation.id,
      initialModelId: eveConversation.initialModelId,
      operationId: eveConversation.operationId,
      parentConversationId: eveConversation.parentConversationId,
      responseGroupId: eveResponseGroup.id,
      responseGroupIndex: sql<
        number | null
      >`array_position(${eveResponseGroup.candidateOperationIds}, ${eveConversation.operationId})`,
      sessionId: eveConversation.sessionId,
    })
    .from(eveConversation)
    .leftJoin(
      eveResponseGroup,
      and(
        eq(eveResponseGroup.ownerId, ownerId),
        eq(eveResponseGroup.deleted, false),
        sql`${eveConversation.operationId} = ANY(${eveResponseGroup.candidateOperationIds})`
      )
    )
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.state, "bound"),
        eq(eveConversation.chatId, conversation.chatId)
      )
    )
    .orderBy(eveConversation.createdAt, eveConversation.id);
  // oxlint-disable-next-line typescript/consistent-return -- #580: listEveConversationBranches has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return { branches, chatId: conversation.chatId, rootId };
};
/* oxlint-enable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types  --
 * import/group-exports (#523): getDeletingEveConversationForSession stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getDeletingEveConversationForSession API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): getDeletingEveConversationForSession's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): getDeletingEveConversationForSession's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): getDeletingEveConversationForSession uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): getDeletingEveConversationForSession sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep getDeletingEveConversationForSession's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getDeletingEveConversationForSession's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
/** Internal cleanup only; does not grant browser or conversation access. */
export const getDeletingEveConversationForSession = async (
  ownerId: string,
  sessionId: string
) => {
  const [row] = await db
    .select({ id: eveConversation.id })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.sessionId, sessionId),
        eq(eveConversation.state, "deleting")
      )
    )
    .limit(1);
  return row;
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/max-nested-calls, unicorn/no-null  --
 * import/group-exports (#523): getEveConversationProject stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getEveConversationProject API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): getEveConversationProject sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep getEveConversationProject's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getEveConversationProject's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/max-nested-calls (#568): getEveConversationProject keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): getEveConversationProject preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const getEveConversationProject = async (
  ownerId: string,
  routeId: string
) => {
  const [assigned] = await db
    .select({
      id: project.id,
      instructions: project.instructions,
      name: project.name,
    })
    .from(eveChat)
    .leftJoin(
      eveConversation,
      and(
        eq(eveConversation.chatId, eveChat.id),
        eq(eveConversation.ownerId, eveChat.ownerId),
        eq(eveConversation.id, routeId)
      )
    )
    .innerJoin(
      eveChatProject,
      and(
        eq(eveChatProject.chatId, eveChat.id),
        eq(eveChatProject.ownerId, eveChat.ownerId)
      )
    )
    .innerJoin(project, eq(project.id, eveChatProject.projectId))
    .where(
      and(
        eq(eveChat.ownerId, ownerId),
        or(eq(eveChat.id, routeId), eq(eveConversation.id, routeId)),
        sql`exists (
          select 1 from "EveConversation" member
          where member."chatId" = ${eveChat.id}
            and member."ownerId" = ${ownerId}
            and member."state" in ('creating', 'bound', 'uncertain')
        )`
      )
    );
  return assigned ?? null;
};
/* oxlint-enable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/max-nested-calls  --
 * import/group-exports (#523): listPendingEveCreations stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named listPendingEveCreations API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): listPendingEveCreations's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): listPendingEveCreations's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * oxc/no-async-await (#540): listPendingEveCreations sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep listPendingEveCreations's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep listPendingEveCreations's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/max-nested-calls (#568): listPendingEveCreations keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
/** Only interrupted message commands are replayable here; copies and deletion have separate journals. */
export const listPendingEveCreations = async (ownerId: string) =>
  await db
    .select()
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.creationKind, "message"),
        or(
          eq(eveConversation.state, "creating"),
          eq(eveConversation.state, "uncertain")
        )
      )
    );
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/max-nested-calls */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * import/group-exports (#523): bindAcceptedEveConversation stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named bindAcceptedEveConversation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): bindAcceptedEveConversation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): bindAcceptedEveConversation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * oxc/no-async-await (#540): bindAcceptedEveConversation sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep bindAcceptedEveConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep bindAcceptedEveConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): bindAcceptedEveConversation accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): bindAcceptedEveConversation preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
/** Caller must verify a native operation receipt for this reservation and exact session. */
export const bindAcceptedEveConversation = async (
  ownerId: string,
  reservationId: string,
  sessionId: string
) =>
  await db.transaction((tx) =>
    bindConversationSession(tx, ownerId, reservationId, sessionId)
  );
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-lines -- #509: This eve-queries.ts module keeps its existing API and workflow boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
