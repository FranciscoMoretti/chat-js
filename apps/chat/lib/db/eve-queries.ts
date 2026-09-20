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

import { initializeEveForkDocuments } from "./eve-documents";
import { referenceEveFiles } from "./eve-files";
import { tombstoneEveResponseGroups } from "./eve-response-groups";

// Creation reservations remain readable for recovery; deleting transcripts do not.
const visibleConversation = inArray(eveConversation.state, [
  "creating",
  "bound",
  "uncertain",
]);

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

export const ownsEveSession = async (ownerId: string, sessionId: string) =>
  Boolean(await getBoundEveConversationForSession(ownerId, sessionId));
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
  const escapedSearch = search.replaceAll(/[\\%_]/gu, "\\$&");
  const rows = await db
    .select({
      conversationId: routeConversationId,
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

export const getEveChatIdentity = async (ownerId: string, routeId: string) => {
  const [identity] = await db
    .select({
      chatId: eveChat.id,
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
    .limit(1);
  return identity;
};
export class CreationConflictError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CreationConflictError";
  }
}

const assertCreationAvailable = (
  state: typeof eveConversation.$inferSelect.state
) => {
  if (state === "deleting" || state === "deleted") {
    throw new CreationConflictError(
      "This conversation can no longer be created."
    );
  }
};

const boundConversation = (
  row: typeof eveConversation.$inferSelect | undefined
) =>
  row?.state === "bound" && row.sessionId
    ? { id: row.id, sessionId: row.sessionId }
    : undefined;

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

export class CreationProjectNotFoundError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CreationProjectNotFoundError";
  }
}

const assertResponseGroupCandidateAvailable = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerId: string,
  operationId: string
) => {
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

const assertGuestCreationAdmission = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerId: string,
  operationId: string,
  reservationId?: string
) => {
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

const assignCreationProject = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  chatId: string,
  ownerId: string,
  projectId: string
) => {
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
      if (references.length) {
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
    return {
      conversations: conversations.toSorted((left, right) =>
        left.id.localeCompare(right.id)
      ),
      rootId: source.chatId,
    };
  });

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
) =>
  existing.parentConversationId === (fork?.conversationId ?? null) &&
  existing.forkTurnId === (fork?.beforeTurnId ?? null) &&
  existing.forkMessageId === (fork?.beforeMessageId ?? null) &&
  existing.forkCheckpointId === (fork?.checkpointId ?? null) &&
  existing.forkKind === forkKind;

/** The dispatcher must use the supplied reservation ID as Eve's idempotency key. */
// oxlint-disable-next-line eslint/complexity -- Keep the atomic admission and validation branches together at this transaction boundary.
export const createEveConversation = async (
  ownerId: string,
  operationId: string,
  message: string,
  create: (id: string) => Promise<string>,
  {
    initialModelId,
    initialContentHash,
    initialTitle = message,
    fork,
    forkKind,
    fileKeys = [],
    initialProjectId,
    guestReservationId,
  }: {
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
          "Creation is still in progress. Retry the same operation shortly."
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
      const [bound] = await tx
        .update(eveConversation)
        .set({ sessionId, state: "bound" })
        .where(
          and(
            eq(eveConversation.id, reservation.id),
            or(
              eq(eveConversation.state, "creating"),
              eq(eveConversation.state, "uncertain")
            )
          )
        )
        .returning();
      if (!bound?.sessionId) {
        throw new Error("Session binding was not saved.");
      }
      await tx
        .update(eveChat)
        .set({
          activeConversationId: sql`coalesce(${eveChat.activeConversationId}, ${bound.id}::uuid)`,
          updatedAt: new Date(),
        })
        .where(and(eq(eveChat.id, bound.chatId), eq(eveChat.ownerId, ownerId)));
      return { id: bound.id, sessionId: bound.sessionId };
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

export const isEveRootTitlePending = async (
  ownerId: string,
  conversationId: string,
  fallbackTitle: string
) => {
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

export const replaceEveRootFallbackTitle = async (
  ownerId: string,
  conversationId: string,
  fallbackTitle: string,
  generatedTitle: string
) => {
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

export const settleEveRootFallbackTitle = async (
  ownerId: string,
  conversationId: string,
  fallbackTitle: string
) => {
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

export const recordEveConversationActivity = async (
  ownerId: string,
  sessionId: string,
  at: Date
) => {
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
  return { branches, chatId: conversation.chatId, rootId };
};

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
