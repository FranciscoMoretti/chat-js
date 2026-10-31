import {
  projectCreationInput,
  projectSelectionAvailable,
} from "@/lib/eve/project-creation";
import { CreationRejectedError } from "@/lib/creation-rejected-error";
import { chat } from "@/integrations/chat";
import { reserveConversationWorkspace } from "./eve-workspaces";
import { eveDeletionScope } from "./eve-deletion-scope";
import { markEveCreationFailure } from "./eve-creation-failure";
import { dispatchEveOnce } from "./eve-dispatch";
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
  eveConversation,
  eveDispatch,
  eveResponseGroup,
} from "@/lib/db/schema";
import { CreationConflictError } from "./creation-conflict-error";
import type { EveForkInput } from "@/lib/eve/contracts";
import type { EveHistoryInput } from "@/lib/eve/history-input";
import { EveSessionMappingError } from "@/lib/eve/session-mapping-error";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { initializeEveCurrentCopy } from "./eve-current-copy";
import { referenceEveFiles } from "./eve-files";
import { tombstoneEveResponseGroups } from "./eve-response-groups";

const FIRST_PARAMETER_INDEX = 0;
const FIRST_RESULT_INDEX = 0;
const SINGLE_MATCH_LIMIT = 1;
const CHAT_PAGE_SIZE = 50;
const NEXT_PAGE_LOOKAHEAD = 1;
const LAST_RESULT_OFFSET = -1;

const hasQueryRow: (row: unknown) => boolean = Boolean;

const isNonemptyString = (value: string | null | undefined): value is string =>
  typeof value === "string" && value !== "";

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
  href: string;
  parentHref: string;
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

const getBoundEveConversationForSession = async (
  ownerId: string,
  sessionId: string
): Promise<Pick<ConversationRow, "id"> | null> => {
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
    .limit(SINGLE_MATCH_LIMIT);
  return rows[FIRST_RESULT_INDEX] ?? null;
};

/**
 * Internal mapping lookup includes tombstones so deletion cannot look like pending delivery.
 * @param {Readonly<{ reservationId: string } | { sessionId: string }>} identity Exact reservation or native session whose durable mapping is inspected.
 * @returns {Promise<Pick<ConversationRow, "creationKind" | "id" | "ownerId" | "sessionId" | "state" | "parentConversationId"> | null>} The durable identity and state, including tombstones, or null when no mapping exists.
 */
const readEveSessionMapping = async (
  identity: Readonly<{ reservationId: string } | { sessionId: string }>
): Promise<Pick<
  ConversationRow,
  | "creationKind"
  | "id"
  | "ownerId"
  | "sessionId"
  | "state"
  | "parentConversationId"
> | null> => {
  const [row] = await db
    .select({
      creationKind: eveConversation.creationKind,
      parentConversationId: eveConversation.parentConversationId,
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
  return row ?? null;
};
const ownsEveSession = async (
  ownerId: string,
  sessionId: string
): Promise<boolean> =>
  Boolean(await getBoundEveConversationForSession(ownerId, sessionId));
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
  const { search = "", cursor, surface = "all" } = input ?? {};
  const { title } = eveChat;
  // Preserve PostgreSQL's microseconds: converting the cursor to Date can skip
  // conversations sharing the same millisecond at a page boundary.
  const updatedAt = sql<string>`to_char(${eveChat.updatedAt}, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
  // Qualify correlated references explicitly: Drizzle strips column qualifiers
  // from selected SQL expressions when the outer query has only one table.
  const routeConversationId = sql<string>`coalesce((
    select active."id" from "EveConversation" active
    where active."id" = ${eveChat}."activeConversationId"
      and active."chatId" = ${eveChat}."id"
      and active."ownerId" = ${ownerId}
      and active."state" in ('creating', 'bound', 'uncertain', 'deleting')
  ), (
    select member."id" from "EveConversation" member
    where member."chatId" = ${eveChat}."id"
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
    where member."chatId" = ${eveChat}."id"
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
  const escapedSearch = search.replaceAll(/[\\%_]/gu, String.raw`\$&`);
  const rows = await db
    .select({
      conversationId: routeConversationId,
      createdAt: eveChat.createdAt,
      id: eveChat.id,
      isPinned: eveChat.isPinned,
      state: chatState,
      title,
      titleStatus: eveChat.titleStatus,
      updatedAt,
    })
    .from(eveChat)
    .where(
      and(
        eq(eveChat.ownerId, ownerId),
        sql`exists (
          select 1 from "EveConversation" member
          where member."chatId" = ${eveChat.id}
            and member."ownerId" = ${ownerId}
            and member."state" in ('creating', 'bound', 'uncertain', 'deleting')
        )`,
        chat.historyFilter(input ?? {}, surface),
        search ? ilike(title, `%${escapedSearch}%`) : undefined,
        beforeCursor
      )
    )
    .orderBy(desc(eveChat.isPinned), desc(eveChat.updatedAt), desc(eveChat.id))
    .limit(CHAT_PAGE_SIZE + NEXT_PAGE_LOOKAHEAD);
  const links = await chat.links(
    ownerId,
    rows.map((row) => row.id)
  );
  const page = rows.slice(FIRST_RESULT_INDEX, CHAT_PAGE_SIZE).map((row) => ({
    ...row,
    ...(links.get(row.id) ?? {
      href: `/chat/${row.id}` as const,
      parentHref: "/" as const,
    }),
  }));
  const last = page.at(LAST_RESULT_OFFSET);
  return {
    items: page,
    nextCursor:
      rows.length > CHAT_PAGE_SIZE && last
        ? { id: last.id, isPinned: last.isPinned, updatedAt: last.updatedAt }
        : null,
  };
};
const getEveConversation = async (
  ownerId: string,
  id: string
): Promise<ConversationDetails | null> => {
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
    .limit(SINGLE_MATCH_LIMIT);
  if (!hasQueryRow(row)) {
    return null;
  }
  return {
    ...row.conversation,
    chatId: row.chat.id,
    id: row.conversation.id,
    isPinned: row.chat.isPinned,
    title: row.chat.title,
    titleStatus: row.chat.titleStatus,
    updatedAt: row.chat.updatedAt,
  };
};

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
    .limit(SINGLE_MATCH_LIMIT);
  if (!hasQueryRow(logical)) {
    return null;
  }
  if (isNonemptyString(logical.activeConversationId)) {
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
    .limit(SINGLE_MATCH_LIMIT);
  if (hasQueryRow(member)) {
    return await getEveConversation(ownerId, member.id);
  }
  return null;
};

const getEveChatIdentity = async (
  ownerId: string,
  routeId: string
): Promise<
  | (Pick<ChatRow, "isPinned" | "title" | "titleStatus"> & {
      chatId: ChatRow["id"];
      href: string;
      parentHref: string;
      visibility: ConversationRow["visibility"] | null;
    })
  | undefined
> => {
  const [identity] = await db
    .select({
      chatId: eveChat.id,
      isPinned: eveChat.isPinned,
      title: eveChat.title,
      titleStatus: eveChat.titleStatus,
      visibility: eveConversation.visibility,
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
    .where(
      and(
        eq(eveChat.ownerId, ownerId),
        or(eq(eveChat.id, routeId), eq(eveConversation.id, routeId))
      )
    )
    .limit(SINGLE_MATCH_LIMIT);
  if (identity === undefined) {
    return undefined;
  }
  const links = await chat.links(ownerId, [identity.chatId]);
  return {
    ...identity,
    ...(links.get(identity.chatId) ?? {
      href: `/chat/${identity.chatId}`,
      parentHref: "/",
    }),
  };
};
const assertCreationAvailable = (
  state: typeof eveConversation.$inferSelect.state
): void => {
  if (state === "deleting" || state === "deleted") {
    throw new CreationConflictError(
      "This conversation can no longer be created."
    );
  }
};

const boundConversation = (
  row: Readonly<Pick<ConversationRow, "id" | "state" | "sessionId">> | undefined
): BoundConversation | undefined => {
  if (row?.state === "bound" && isNonemptyString(row.sessionId)) {
    return { id: row.id, sessionId: row.sessionId };
  }
  return undefined;
};

const getEveCreation = async (
  ownerId: string,
  operationId: string
): Promise<ConversationRow | undefined> => {
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
    .limit(SINGLE_MATCH_LIMIT);
  if (hasQueryRow(deletedGroup)) {
    throw new CreationConflictError("This response group has been deleted.");
  }
};

const resolveCreationChat = async (
  tx: CreationTransactionView,
  value: ReadonlyNativeSurface<
    Omit<typeof eveConversation.$inferInsert, "chatId" | "workspaceId">
  >,
  fork?: EveForkInput
): Promise<{ chatId: string; source: ConversationRow | undefined }> => {
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
  if (fork && !isNonemptyString(source?.sessionId)) {
    throw new CreationConflictError(
      "The source conversation is not available for editing."
    );
  }
  const [initialGroup] = hasQueryRow(source)
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
        .limit(SINGLE_MATCH_LIMIT);
  const chatId = source?.chatId ?? initialGroup?.id ?? crypto.randomUUID();
  return { chatId, source };
};

const reserveEveConversation = async (
  value: ReadonlyNativeSurface<
    Omit<typeof eveConversation.$inferInsert, "chatId" | "workspaceId">
  >,
  initialTitle: string,
  fork?: EveForkInput
): Promise<ConversationRow[]> =>
  await db.transaction(async (tx: CreationTransactionView) => {
    // Shared with deletion: a new fork cannot appear behind its family fence.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${value.ownerId}`}, 0))`
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
      .limit(SINGLE_MATCH_LIMIT);
    if (hasQueryRow(existingReservation)) {
      return [];
    }
    const { chatId, source } = await resolveCreationChat(tx, value, fork);
    const workspaceId = await reserveConversationWorkspace(
      tx,
      value.ownerId,
      source?.id
    );
    const [createdChat] = await tx
      .insert(eveChat)
      .values({ id: chatId, ownerId: value.ownerId, title: initialTitle })
      .onConflictDoNothing()
      .returning({ id: eveChat.id });
    if (!hasQueryRow(createdChat)) {
      const [existingChat] = await tx
        .select({ id: eveChat.id })
        .from(eveChat)
        .where(and(eq(eveChat.id, chatId), eq(eveChat.ownerId, value.ownerId)));
      if (!hasQueryRow(existingChat)) {
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
        workspaceId,
        forkKind: value.forkKind,
        parentConversationId: fork?.conversationId,
        forkMessageId: fork?.beforeMessageId,
        rootConversationId:
          source === undefined
            ? undefined
            : (source.rootConversationId ?? source.id),
      })
      .onConflictDoNothing()
      .returning();
    if (hasQueryRow(createdChat)) {
      const { projectId } = projectCreationInput.parse(
        value.initialRequest ?? {}
      );
      if (!projectSelectionAvailable(projectId)) {
        throw new CreationRejectedError(
          "Projects plugin is not installed.",
          "projects_unavailable"
        );
      }
      await chat.onCreate({
        tx,
        chatId,
        ownerId: value.ownerId,
        projectId,
      });
    }
    return rows;
  });

/**
 * Fences every conversation in the selected logical chat for deletion.
 * The returned session IDs can then be retired before physical purge.
 * @param {string} ownerId Owner of the selected conversation or chat.
 * @param {string} id Conversation or logical chat ID used to find the family.
 * @returns {Promise<{ conversations: Array<Pick<ConversationRow, "id" | "sessionId">>; rootId: string } | null>} The chat root and fenced conversation IDs, or null when no owned record matches.
 * @throws {CreationConflictError} when creation recovery is still in progress.
 */
const beginEveConversationDeletion = async (
  ownerId: string,
  id: string
): Promise<{
  conversations: Pick<ConversationRow, "id" | "sessionId">[];
  rootId: string;
} | null> =>
  await db.transaction(
    async (
      tx: CreationTransactionView
    ): ReturnType<typeof beginEveConversationDeletion> => {
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
      if (!hasQueryRow(source)) {
        return null;
      }
      const familyCondition = eveDeletionScope(ownerId, id);
      const family = await tx
        .select()
        .from(eveConversation)
        .where(familyCondition)
        .orderBy(eveConversation.id);
      // The app journal commits under this same owner lock before any native
      // call. A creating/deleting row with no journal/binding can skip native cleanup,
      // but remains deleting through resource cleanup. Dispatched uncertainty stays fenced.
      const dispatched = await tx
        .select({ conversationId: eveDispatch.conversationId })
        .from(eveDispatch)
        .where(
          and(
            eq(eveDispatch.ownerId, ownerId),
            inArray(
              eveDispatch.conversationId,
              family.map((row) => row.id)
            )
          )
        );
      const dispatchedIds = new Set(
        dispatched.map((row) => row.conversationId)
      );
      const undispatched = new Set(
        family
          .filter(
            (row) =>
              ["creating", "deleting"].includes(row.state) &&
              row.sessionId === null &&
              !dispatchedIds.has(row.id)
          )
          .map((row) => row.id)
      );
      if (
        family.some(
          (row) =>
            row.state === "uncertain" ||
            (row.state === "creating" && !undispatched.has(row.id))
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
        // oxlint-disable-next-line eslint/no-await-in-loop -- Family deletion must acquire each eve-document advisory lock before changing bound rows to deleting; document writers hold these locks through commit.
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
            inArray(eveConversation.state, ["creating", "bound", "deleting"])
          )
        )
        .returning({
          id: eveConversation.id,
          sessionId: eveConversation.sessionId,
        });
      return {
        conversations: conversations
          .filter((row) => !undispatched.has(row.id))
          .toSorted((left, right) => left.id.localeCompare(right.id)),
        rootId: id,
      };
    }
  );

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
  existing.forkKind === forkKind &&
  existing.forkMessageId === (fork?.beforeMessageId ?? null);

type CreationTransaction = Parameters<
  Parameters<typeof db.transaction>[typeof FIRST_PARAMETER_INDEX]
>[typeof FIRST_PARAMETER_INDEX];
type CreationTransactionView = Readonly<
  Pick<CreationTransaction, "select" | "execute" | "insert" | "update">
>;

const bindConversationSession = async (
  tx: CreationTransactionView,
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
  if (hasQueryRow(sessionBinding) && sessionBinding.id !== reservationId) {
    throw new EveSessionMappingError("binding_conflict");
  }
  const [bound] = await tx
    .update(eveConversation)
    .set({ initialRequest: null, initialSeed: null, sessionId, state: "bound" })
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
  if (!isNonemptyString(bound?.sessionId)) {
    const [existing] = await tx
      .select()
      .from(eveConversation)
      .where(eq(eveConversation.id, reservationId));
    if (!hasQueryRow(existing)) {
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

const assertMatchingMessageCreation = (
  existing: ConversationRow | undefined,
  message: string,
  initialModelId: string | undefined,
  initialContentHash: string | undefined,
  fork: ReadonlyNativeSurface<EveForkInput> | undefined,
  forkKind: typeof eveConversation.$inferInsert.forkKind,
  seedOnly: boolean
): ConversationRow => {
  if (
    existing === undefined ||
    existing.creationKind !== (seedOnly ? "copy" : "message") ||
    existing.firstMessage !== message ||
    existing.initialModelId !== (initialModelId ?? null) ||
    existing.initialContentHash !== (initialContentHash ?? null) ||
    !matchesEveFork(existing, fork, forkKind ?? null)
  ) {
    throw new CreationConflictError(
      "This operation already has a different message, attachments, model, tool selection, or source conversation."
    );
  }
  return existing;
};

/**
 * Reserves a conversation under the owner’s operation ID and binds it to a native session.
 * The reserved conversation ID is passed to the native creator as its idempotency key.
 * @param {string} ownerId Owner creating the conversation.
 * @param {string} operationId Stable owner-scoped operation ID used to find or reuse the conversation reservation.
 * @param {string} message First user message and default conversation title.
 * @param {(id: string) => string | Promise<string>} create Native-session creator called with the reserved conversation ID as native idempotency key; its result is awaited before binding.
 * @param {string} [initialModelId] Initial model to use for the conversation.
 * @param {unknown} [initialRequest] Initial request metadata persisted with the conversation.
 * @param {string} [initialContentHash] Hash used to identify the initial content.
 * @param {string} [initialTitle] Initial title; defaults to the first message.
 * @param {EveForkInput} [fork] Current completed source conversation to copy.
 * @param {typeof eveConversation.$inferInsert.forkKind} [forkKind] Fork type for the new conversation.
 * @param {string[]} [fileKeys] File keys attached to the initial message.
 * @returns {Promise<BoundConversation>} The bound conversation after native session creation succeeds.
 */
const createEveConversation = async (
  ownerId: string,
  operationId: string,
  message: string,
  create: (id: string) => Promise<{ sessionId: string; deliveryId?: string }>,
  {
    initialModelId,
    initialRequest,
    initialContentHash,
    initialTitle = message,
    fork,
    forkKind,
    fileKeys = [],
    seedOnly = false,
  }: ReadonlyNativeSurface<{
    initialRequest?: unknown;
    initialModelId?: string;
    initialContentHash?: string;
    initialTitle?: string;
    fork?: EveForkInput;
    forkKind?: typeof eveConversation.$inferInsert.forkKind;
    fileKeys?: string[];
    seedOnly?: boolean;
  }> = {}
): Promise<BoundConversation> => {
  if ((forkKind || seedOnly) && !fork) {
    throw new CreationConflictError(
      "Fork intent requires a source conversation."
    );
  }
  let [reservation] = await reserveEveConversation(
    {
      firstMessage: message,
      creationKind: seedOnly ? "copy" : "message",
      forkKind,
      initialContentHash,
      initialModelId,
      initialRequest,
      operationId,
      ownerId,
    },
    initialTitle,
    fork
  );
  if (!hasQueryRow(reservation)) {
    const [existing] = await db
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.operationId, operationId)
        )
      );
    if (hasQueryRow(existing)) {
      assertCreationAvailable(existing.state);
    }
    const matching = assertMatchingMessageCreation(
      existing,
      message,
      initialModelId,
      initialContentHash,
      fork,
      forkKind,
      seedOnly
    );
    const binding = boundConversation(matching);
    if (binding) {
      return binding;
    }
    reservation = matching;
  }
  try {
    // This idempotent initialization commits before dispatch and acquires its own
    // document lock. Do not nest its connection inside the creation transaction.
    if (fork) {
      await initializeEveCurrentCopy(ownerId, reservation.id);
    }
    await referenceEveFiles(ownerId, reservation.id, fileKeys);
    const dispatched = await dispatchEveOnce(
      {
        ownerId,
        operationId: reservation.id,
        conversationId: reservation.id,
        kind: seedOnly ? "copy" : "create",
        intent: reservation.initialRequest ?? {
          message,
          initialModelId,
          initialContentHash,
          fork,
          forkKind,
        },
      },
      async () =>
        await db.transaction(async (tx: CreationTransactionView) => {
          // The reservation is already committed so native hooks can find it.
          // Transaction locks release on worker death; creating rows need no manual repair.
          const [lock] = await tx
            .select({
              locked: sql<boolean>`pg_try_advisory_xact_lock(hashtextextended(${`eve-create:${reservation.id}`}, 0))`,
            })
            .from(eveConversation)
            .where(eq(eveConversation.id, reservation.id));
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
              hasQueryRow(current) &&
              current.creationKind === (seedOnly ? "copy" : "message") &&
              (current.state === "creating" || current.state === "uncertain")
            )
          ) {
            throw new CreationConflictError(
              "This conversation can no longer be created."
            );
          }
          const accepted = await create(reservation.id);
          const bound = await bindConversationSession(
            tx,
            ownerId,
            reservation.id,
            accepted.sessionId
          );
          return { ...bound, deliveryId: accepted.deliveryId };
        })
    );
    return { id: reservation.id, sessionId: dispatched.sessionId };
  } catch (error) {
    if (error instanceof CreationConflictError) {
      throw error;
    }
    await markEveCreationFailure(reservation.id, error);
    throw error;
  }
};

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
const updateEveConversationMetadata = async (
  ownerId: string,
  id: string,
  updates: Readonly<{
    title?: string;
    isPinned?: boolean;
  }>
): Promise<Pick<ConversationRow, "id"> | undefined> => {
  let titleStatus: "manual" | undefined = undefined;
  if (isNonemptyString(updates.title)) {
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

const listEveConversationBranches = async (
  ownerId: string,
  conversationId: string
): Promise<ConversationBranchListing | undefined> => {
  const conversation = await getEveChatPageConversation(
    ownerId,
    conversationId
  );
  if (!conversation) {
    return undefined;
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
  return { branches, chatId: conversation.chatId, rootId };
};

/**
 * Internal cleanup only; does not grant browser or conversation access.
 * @param {string} ownerId Owner whose deleting session mapping is inspected.
 * @param {string} sessionId Native session being removed by internal cleanup.
 * @returns {Promise<Pick<ConversationRow, "id"> | null>} The deleting conversation identity, or null when no owned deleting mapping exists.
 */
const getDeletingEveConversationForSession = async (
  ownerId: string,
  sessionId: string
): Promise<Pick<ConversationRow, "id"> | null> => {
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
    .limit(SINGLE_MATCH_LIMIT);
  return row ?? null;
};

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
  await db.transaction(
    async (tx: CreationTransactionView) =>
      await bindConversationSession(tx, ownerId, reservationId, sessionId)
  );

export {
  beginEveConversationDeletion,
  bindAcceptedEveConversation,
  createEveConversation,
  getBoundEveConversationForSession,
  getDeletingEveConversationForSession,
  getEveChatIdentity,
  getEveChatPageConversation,
  getEveConversation,
  getEveCreation,
  listEveConversationBranches,
  listEveConversations,
  listEveOwnerBindings,
  listPendingEveCreations,
  ownsEveSession,
  readEveSessionMapping,
  recordEveConversationActivity,
  updateEveConversationMetadata,
};
export { CreationConflictError } from "./creation-conflict-error";
