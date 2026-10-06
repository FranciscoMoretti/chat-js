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
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
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
/* oxlint-enable sort-imports */
import type { EveForkInput } from "@/lib/eve/contracts";
import type { EveHistoryInput } from "@/lib/eve/history-input";
import { EveSessionMappingError } from "@/lib/eve/session-mapping-error";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { initializeEveForkDocuments } from "./eve-documents";
import { referenceEveFiles } from "./eve-files";
import { tombstoneEveResponseGroups } from "./eve-response-groups";

type ConversationRow = typeof eveConversation.$inferSelect;
type ChatRow = typeof eveChat.$inferSelect;
type ConversationDetails = ConversationRow &
  Pick<ChatRow, "isPinned" | "title" | "titleStatus" | "updatedAt">;
type BoundConversation = Pick<ConversationRow, "id"> & { sessionId: string };
type ConversationListItem = Pick<
  ChatRow,
  "createdAt" | "id" | "isPinned" | "title" | "titleStatus"
> & {
  conversationId: string;
  projectId: string | null;
  state: Exclude<ConversationRow["state"], "deleted">;
  updatedAt: string;
};
interface ConversationBranchListing {
  branches: ConversationBranch[];
  chatId: string;
  rootId: string;
}

type ConversationBranch = Pick<
  ConversationRow,
  | "createdAt"
  | "firstMessage"
  | "forkKind"
  | "forkMessageId"
  | "forkTurnId"
  | "id"
  | "initialModelId"
  | "operationId"
  | "parentConversationId"
  | "sessionId"
> & {
  groupCandidates: typeof eveResponseGroup.$inferSelect.candidates | null;
  responseGroupId: string | null;
  responseGroupIndex: number | null;
};

// Creation reservations remain readable for recovery; deleting transcripts do not.
const visibleConversation = inArray(eveConversation.state, [
  "creating",
  "bound",
  "uncertain",
]);

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getBoundEveConversationForSession's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers -- moving it below executable initialization can obscure ordering and API ownership.
no-magic-numbers (#517): getBoundEveConversationForSession uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const getBoundEveConversationForSession = async (
  ownerId: string,
  sessionId: string
): Promise<Pick<ConversationRow, "id">> => {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readEveSessionMapping's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/**
 * Internal mapping lookup includes tombstones so deletion cannot look like pending delivery.
 * @param {Readonly<{ reservationId: string } | { sessionId: string }>} identity Exact reservation or native session whose durable mapping is inspected.
 * @returns {Promise< Pick< ConversationRow, "creationKind" | "id" | "ownerId" | "sessionId" | "state" > >} The durable identity and state, including tombstones, from the existing row lookup.
 */
const readEveSessionMapping = async (
  identity: Readonly<{ reservationId: string } | { sessionId: string }>
): Promise<
  Pick<
    ConversationRow,
    "creationKind" | "id" | "ownerId" | "sessionId" | "state"
  >
> => {
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
      // oxlint-disable-next-line no-ternary -- Keep db .select({ creationKind: eveConversation.creationKind as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      "reservationId" in identity
        ? eq(eveConversation.id, identity.reservationId)
        : eq(eveConversation.sessionId, identity.sessionId)
    );
  return row;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ownsEveSession's awaited sequencing and rejected-Promise behavior. */
const ownsEveSession = async (
  ownerId: string,
  sessionId: string
): Promise<boolean> =>
  Boolean(await getBoundEveConversationForSession(ownerId, sessionId));
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve listEveConversations's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null -- moving it below executable initialization can obscure ordering and API ownership.
max-lines-per-function (#510): listEveConversations keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): listEveConversations keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): listEveConversations uses 51, 0, 50, -1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
no-undefined (#519): listEveConversations uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/strict-boolean-expressions (#610): listEveConversations intentionally keeps the existing falsy-value behavior of projectId; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/max-nested-calls (#568): listEveConversations keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
unicorn/no-null (#570): listEveConversations preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const listEveConversations = async (
  ownerId: string,
  input?: EveHistoryInput
): Promise<{
  items: ConversationListItem[];
  nextCursor: Pick<
    ConversationListItem,
    "id" | "isPinned" | "updatedAt"
  > | null;
}> => {
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
  // oxlint-disable-next-line no-ternary -- Keep beforeCursor as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const beforeCursor = cursor
    ? or(
        // oxlint-disable-next-line no-ternary -- Keep or argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
  // oxlint-disable-next-line no-ternary -- Keep matchesProject as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
        // oxlint-disable-next-line no-ternary -- Keep and argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        projectId === undefined ? undefined : matchesProject,
        // oxlint-disable-next-line no-ternary -- Keep and argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
      // oxlint-disable-next-line no-ternary -- Keep nextCursor as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      rows.length > 50 && last
        ? { id: last.id, isPinned: last.isPinned, updatedAt: last.updatedAt }
        : null,
  };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEveConversation's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null */
/* oxlint-disable no-magic-numbers, no-undefined, typescript/strict-boolean-expressions -- moving it below executable initialization can obscure ordering and API ownership.
no-magic-numbers (#517): getEveConversation uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
no-undefined (#519): getEveConversation uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/strict-boolean-expressions (#610): getEveConversation intentionally keeps the existing falsy-value behavior of row; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const getEveConversation = async (
  ownerId: string,
  id: string
): Promise<ConversationDetails | undefined> => {
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
  if (!row) {
    return undefined;
  }
  return {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing row.conversation own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...row.conversation,
    chatId: row.chat.id,
    id: row.conversation.id,
    isPinned: row.chat.isPinned,
    title: row.chat.title,
    titleStatus: row.chat.titleStatus,
    updatedAt: row.chat.updatedAt,
  };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEveChatPageConversation's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, no-undefined, typescript/strict-boolean-expressions */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions -- moving it below executable initialization can obscure ordering and API ownership.
max-statements (#512): getEveChatPageConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): getEveChatPageConversation uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
no-undefined (#519): getEveChatPageConversation uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/strict-boolean-expressions (#610): getEveChatPageConversation intentionally keeps the existing falsy-value behavior of logical; logical.activeConversationId; member; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/**
 * Resolve either a logical chat route or an exact private session route.
 * @param {string} ownerId Owner used to scope both exact and logical route lookups.
 * @param {string} routeId Exact conversation or logical chat route to resolve.
 * @returns {ReturnType<typeof getEveConversation>} The visible owned conversation, preferring the logical active member, or no result.
 */
const getEveChatPageConversation = async (
  ownerId: string,
  routeId: string
): ReturnType<typeof getEveConversation> => {
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading chatId from active; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
  if (member) {
    return await getEveConversation(ownerId, member.id);
  }
  return undefined;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEveChatIdentity's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions */

/* oxlint-disable no-magic-numbers, unicorn/max-nested-calls -- moving it below executable initialization can obscure ordering and API ownership.
no-magic-numbers (#517): getEveChatIdentity uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
unicorn/max-nested-calls (#568): getEveChatIdentity keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const getEveChatIdentity = async (
  ownerId: string,
  routeId: string
): Promise<
  Pick<ChatRow, "isPinned" | "title" | "titleStatus"> & {
    chatId: ChatRow["id"];
    projectId: string | null;
    visibility: ConversationRow["visibility"] | null;
  }
> => {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, unicorn/max-nested-calls */
class CreationConflictError extends Error {
  public readonly code: "creation_conflict" | "creation_in_progress";
  public constructor(
    message?: string,
    options?: Readonly<
      ErrorOptions & {
        code?: "creation_conflict" | "creation_in_progress";
      }
    >
  ) {
    super(message, options);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading code from options; preserve one receiver evaluation, skipped accesses and the existing "creation_conflict" fallback. The app guidance prefers optional chaining.
    this.code = options?.code ?? "creation_conflict";
    this.name = "CreationConflictError";
  }
}

const assertCreationAvailable = (
  state: typeof eveConversation.$inferSelect.state
): void => {
  if (state === "deleting" || state === "deleted") {
    throw new CreationConflictError(
      "This conversation can no longer be created."
    );
  }
};

/* oxlint-disable no-undefined, typescript/strict-boolean-expressions --
 * no-undefined (#519): boundConversation returns the existing optional-result sentinel for unbound rows or missing/empty session IDs.
 * typescript/strict-boolean-expressions (#610): A bound row needs a nonempty session ID; preserve the existing single condition read before constructing its result.
 */
const boundConversation = (
  row: Readonly<Pick<ConversationRow, "id" | "state" | "sessionId">> | undefined
): BoundConversation | undefined => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading state from row; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (row?.state === "bound" && row.sessionId) {
    return { id: row.id, sessionId: row.sessionId };
  }
  return undefined;
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEveCreation's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined, typescript/strict-boolean-expressions */

const getEveCreation = async (
  ownerId: string,
  operationId: string
): Promise<ConversationRow> => {
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
/* oxlint-enable oxc/no-async-await */
class CreationProjectNotFoundError extends Error {
  public constructor(message?: string, options?: Readonly<ErrorOptions>) {
    super(message, options);
    this.name = "CreationProjectNotFoundError";
  }
}

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve assertResponseGroupCandidateAvailable's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers, typescript/strict-boolean-expressions --
 * no-magic-numbers (#517): assertResponseGroupCandidateAvailable uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/strict-boolean-expressions (#610): assertResponseGroupCandidateAvailable intentionally keeps the existing falsy-value behavior of deletedGroup; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const assertResponseGroupCandidateAvailable = async (
  tx: Readonly<Pick<CreationTransaction, "select">>,
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve assertGuestCreationAdmission's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): assertGuestCreationAdmission keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): assertGuestCreationAdmission keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): assertGuestCreationAdmission keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): assertGuestCreationAdmission uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/strict-boolean-expressions (#610): assertGuestCreationAdmission intentionally keeps the existing falsy-value behavior of reservationId; guest; quota; creation; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const assertGuestCreationAdmission = async (
  tx: Readonly<Pick<CreationTransaction, "select">>,
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve assignCreationProject's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-params, max-statements, typescript/strict-boolean-expressions */

/* oxlint-disable max-params, no-magic-numbers, typescript/strict-boolean-expressions --
 * max-params (#511): assignCreationProject keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): assignCreationProject uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/strict-boolean-expressions (#610): assignCreationProject intentionally keeps the existing falsy-value behavior of target; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const assignCreationProject = async (
  tx: Readonly<Pick<CreationTransaction, "select" | "insert">>,
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reserveEveConversation's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-params, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): reserveEveConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): reserveEveConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): reserveEveConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): reserveEveConversation uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): reserveEveConversation uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): reserveEveConversation accepts value: Omit<typeof eveConversation.$inferInsert, "chatId">; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): reserveEveConversation intentionally keeps the existing falsy-value behavior of existingReservation; source?.sessionId; source; createdChat; existingChat; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const reserveEveConversation = async (
  value: Omit<typeof eveConversation.$inferInsert, "chatId">,
  initialTitle: string,
  fork?: EveForkInput,
  guestReservationId?: string
): Promise<ConversationRow[]> =>
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
    // oxlint-disable-next-line no-ternary -- Keep [source] as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading sessionId from source; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    if (fork && !source?.sessionId) {
      throw new CreationConflictError(
        "The source conversation is not available for editing."
      );
    }
    // oxlint-disable-next-line no-ternary -- Keep [initialGroup] as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading chatId from source; preserve one receiver evaluation, skipped accesses and the existing initialGroup?.id fallback. The app guidance prefers optional chaining. Keep the existing nullish guard when reading id from initialGroup; preserve one receiver evaluation, skipped accesses and the existing initialGroup?.id fallback. The app guidance prefers optional chaining.
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing value own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...value,
        chatId,
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading checkpointId from fork; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        forkCheckpointId: fork?.checkpointId,
        forkKind: value.forkKind,
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading beforeMessageId from fork; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        forkMessageId: fork?.beforeMessageId,
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading beforeTurnId from fork; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        forkTurnId: fork?.beforeTurnId,
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading conversationId from fork; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        parentConversationId: fork?.conversationId,
        // oxlint-disable-next-line no-ternary -- Keep rootConversationId as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve beginEveConversationDeletion's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls -- moving it below executable initialization can obscure ordering and API ownership.
max-lines-per-function (#510): beginEveConversationDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): beginEveConversationDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): beginEveConversationDeletion accepts tx; row; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): beginEveConversationDeletion intentionally keeps the existing falsy-value behavior of source; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/max-nested-calls (#568): beginEveConversationDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
/**
 * Fences every conversation in the selected logical chat for deletion.
 * The returned session IDs can then be retired before physical purge.
 * @param {string} ownerId Owner of the selected conversation or chat.
 * @param {string} id Conversation or logical chat ID used to find the family.
 * @returns {Promise<{ conversations: Array<Pick<ConversationRow, "id" | "sessionId">>; rootId: string } | undefined>} The chat root and fenced conversation IDs, or undefined when no owned record matches.
 * @throws {CreationConflictError} when creation recovery is still in progress.
 */
const beginEveConversationDeletion = async (
  ownerId: string,
  id: string
): Promise<
  | {
      conversations: Pick<ConversationRow, "id" | "sessionId">[];
      rootId: string;
    }
  | undefined
> =>
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls */

/* oxlint-disable unicorn/no-null --
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading conversationId from fork; preserve one receiver evaluation, skipped accesses and the existing null fallback. The app guidance prefers optional chaining.
  existing.parentConversationId === (fork?.conversationId ?? null) &&
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading beforeTurnId from fork; preserve one receiver evaluation, skipped accesses and the existing null fallback. The app guidance prefers optional chaining.
  existing.forkTurnId === (fork?.beforeTurnId ?? null) &&
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading beforeMessageId from fork; preserve one receiver evaluation, skipped accesses and the existing null fallback. The app guidance prefers optional chaining.
  existing.forkMessageId === (fork?.beforeMessageId ?? null) &&
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading checkpointId from fork; preserve one receiver evaluation, skipped accesses and the existing null fallback. The app guidance prefers optional chaining.
  existing.forkCheckpointId === (fork?.checkpointId ?? null) &&
  existing.forkKind === forkKind;
/* oxlint-enable unicorn/no-null */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): CreationTransaction uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
type CreationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve bindConversationSession's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable max-lines-per-function, max-params, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null --
 * max-lines-per-function (#510): bindConversationSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): bindConversationSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): bindConversationSession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
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
): Promise<BoundConversation> => {
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading sessionId from bound; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve createEveConversation's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-params, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-params, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
max-lines-per-function (#510): createEveConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-params (#511): createEveConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): createEveConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): createEveConversation accepts { initialModelId, initialRequest, initialContentHash, initialTitle = message, fo; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): createEveConversation intentionally keeps the existing falsy-value behavior of initialProjectId; reservation; existing; current; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/no-null (#570): createEveConversation preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/**
 * Reserves a conversation under the owner’s operation ID and binds it to a native session.
 * The reserved conversation ID is passed to the native creator as its idempotency key.
 * @param {string} ownerId Owner creating the conversation.
 * @param {string} operationId Stable owner-scoped operation ID used to find or reuse the conversation reservation.
 * @param {string} message First user message and default conversation title.
 * @param {(id: string) => Promise<string>} create Native-session creator called with the reserved conversation ID as native idempotency key.
 * @param {string} [initialModelId] Initial model to use for the conversation.
 * @param {unknown} [initialRequest] Initial request metadata persisted with the conversation.
 * @param {string} [initialContentHash] Hash used to identify the initial content.
 * @param {string} [initialTitle] Initial title; defaults to the first message.
 * @param {EveForkInput} [fork] Source conversation and checkpoint information for a fork.
 * @param {typeof eveConversation.$inferInsert.forkKind} [forkKind] Fork type for the new conversation.
 * @param {string[]} [fileKeys] File keys attached to the initial message.
 * @param {string} [initialProjectId] Project to associate with a new non-fork conversation.
 * @param {string} [guestReservationId] Existing guest reservation to consume.
 * @returns {Promise<BoundConversation>} The bound conversation after native session creation succeeds.
 */
// oxlint-disable-next-line eslint/complexity -- Keep the atomic admission and validation branches together at this transaction boundary.
const createEveConversation = async (
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
): Promise<BoundConversation> => {
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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading locked from lock; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve listEveOwnerBindings's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-params, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

const listEveOwnerBindings = async (
  ownerId: string
): Promise<
  Pick<ConversationRow, "sessionId" | "state" | "usageStreamIndex">[]
> =>
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve updateEveConversationMetadata's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-undefined, typescript/strict-boolean-expressions -- no-undefined (#519): Omit titleStatus in the Drizzle update unless a nonempty title is supplied; visibility updates retain their separate conversation-row path.
typescript/strict-boolean-expressions (#610): Empty title text leaves titleStatus unchanged; keep the original title getter read before the update payload is built.
 */
const updateEveConversationMetadata = async (
  ownerId: string,
  id: string,
  updates: Readonly<{
    title?: string;
    isPinned?: boolean;
    visibility?: "private" | "public";
  }>
): Promise<Pick<ConversationRow, "id">> => {
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
  let titleStatus: "manual" | undefined = undefined;
  if (updates.title) {
    titleStatus = "manual";
  }
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve isEveRootTitlePending's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined, typescript/strict-boolean-expressions */

/* oxlint-disable no-magic-numbers -- no-magic-numbers (#517): isEveRootTitlePending uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const isEveRootTitlePending = async (
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve replaceEveRootFallbackTitle's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-params -- max-params (#511): replaceEveRootFallbackTitle keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const replaceEveRootFallbackTitle = async (
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve settleEveRootFallbackTitle's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-params */

const settleEveRootFallbackTitle = async (
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve recordEveConversationActivity's awaited sequencing and rejected-Promise behavior. */
const recordEveConversationActivity = async (
  ownerId: string,
  sessionId: string,
  at: ReadonlyNativeSurface<Date>
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getPublicEveConversation's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable no-magic-numbers, no-undefined, typescript/strict-boolean-expressions -- no-magic-numbers (#517): getPublicEveConversation uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
no-undefined (#519): getPublicEveConversation uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/strict-boolean-expressions (#610): getPublicEveConversation intentionally keeps the existing falsy-value behavior of row; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const getPublicEveConversation = async (
  id: string
): Promise<(ConversationRow & Pick<ChatRow, "title">) | undefined> => {
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
  if (row) {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing row.conversation own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    return { ...row.conversation, title: row.chat.title };
  }
  return undefined;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve listEveConversationBranches's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, no-undefined, typescript/strict-boolean-expressions */

const listEveConversationBranches = async (
  ownerId: string,
  conversationId: string
): Promise<ConversationBranchListing | undefined> => {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getDeletingEveConversationForSession's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --no-magic-numbers (#517): getDeletingEveConversationForSession uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
/**
 * Internal cleanup only; does not grant browser or conversation access.
 * @param {string} ownerId Owner whose deleting session mapping is inspected.
 * @param {string} sessionId Native session being removed by internal cleanup.
 * @returns {Promise<Pick<ConversationRow, "id">>} The deleting conversation identity from the existing row lookup.
 */
const getDeletingEveConversationForSession = async (
  ownerId: string,
  sessionId: string
): Promise<Pick<ConversationRow, "id">> => {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEveConversationProject's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable unicorn/max-nested-calls, unicorn/no-null --unicorn/max-nested-calls (#568): getEveConversationProject keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
unicorn/no-null (#570): getEveConversationProject preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const getEveConversationProject = async (
  ownerId: string,
  routeId: string
): Promise<
  Pick<typeof project.$inferSelect, "id" | "instructions" | "name">
> => {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve listPendingEveCreations's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable unicorn/max-nested-calls --unicorn/max-nested-calls (#568): listPendingEveCreations keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
/**
 * Only interrupted message commands are replayable here; copies and deletion have separate journals.
 * @param {string} ownerId Owner whose creating and uncertain message commands need recovery.
 * @returns {Promise<ConversationRow[]>} Durable message reservations eligible for replay; copies and deletion are excluded.
 */
const listPendingEveCreations = async (
  ownerId: string
): Promise<ConversationRow[]> =>
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve bindAcceptedEveConversation's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/max-nested-calls */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/promise-function-async --typescript/prefer-readonly-parameter-types (#565): bindAcceptedEveConversation accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/promise-function-async (#606): bindAcceptedEveConversation preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
/**
 * Caller must verify a native operation receipt for this reservation and exact session.
 * @param {string} ownerId Owner whose reservation is bound under its transaction lock.
 * @param {string} reservationId Durable reservation whose accepted native operation has been verified.
 * @param {string} sessionId Exact native session named by the verified operation receipt.
 * @returns {Promise<BoundConversation>} The reservation and session identities after transactional binding.
 */
const bindAcceptedEveConversation = async (
  ownerId: string,
  reservationId: string,
  sessionId: string
): Promise<BoundConversation> =>
  await db.transaction((tx) =>
    bindConversationSession(tx, ownerId, reservationId, sessionId)
  );
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (beginEveConversationDeletion, bindAcceptedEveConversation, createEveConversation, CreationConflictError, CreationProjectNotFoundError, getBoundEveConversationForSession, getDeletingEveConversationForSession, getEveChatIdentity, getEveChatPageConversation, getEveConversation, getEveConversationProject, getEveCreation, getPublicEveConversation, isEveRootTitlePending, listEveConversationBranches, listEveConversations, listEveOwnerBindings, listPendingEveCreations, ownsEveSession, readEveSessionMapping, recordEveConversationActivity, replaceEveRootFallbackTitle, settleEveRootFallbackTitle, updateEveConversationMetadata); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-lines -- #509: This eve-queries.ts module keeps its existing API and workflow boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric.
 */
export {
  beginEveConversationDeletion,
  bindAcceptedEveConversation,
  createEveConversation,
  CreationConflictError,
  CreationProjectNotFoundError,
  getBoundEveConversationForSession,
  getDeletingEveConversationForSession,
  getEveChatIdentity,
  getEveChatPageConversation,
  getEveConversation,
  getEveConversationProject,
  getEveCreation,
  getPublicEveConversation,
  isEveRootTitlePending,
  listEveConversationBranches,
  listEveConversations,
  listEveOwnerBindings,
  listPendingEveCreations,
  ownsEveSession,
  readEveSessionMapping,
  recordEveConversationActivity,
  replaceEveRootFallbackTitle,
  settleEveRootFallbackTitle,
  updateEveConversationMetadata,
};
/* oxlint-enable import/no-named-export */
