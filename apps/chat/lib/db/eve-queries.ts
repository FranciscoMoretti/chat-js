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
  eveConversation,
  eveConversationProject,
  eveFileReference,
  project,
} from "@/lib/db/schema";
import type { EveForkInput } from "@/lib/eve/contracts";
import type { EveHistoryInput } from "@/lib/eve/history-input";
import { initializeEveForkDocuments } from "./eve-documents";
import { referenceEveFiles } from "./eve-files";

// Creation reservations remain visible for recovery; deletion records never do.
const visibleConversation = inArray(eveConversation.state, [
  "creating",
  "bound",
  "uncertain",
]);

export async function ownsEveSession(ownerId: string, sessionId: string) {
  return Boolean(await getBoundEveConversationForSession(ownerId, sessionId));
}

export async function getBoundEveConversationForSession(
  ownerId: string,
  sessionId: string
) {
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
}
export async function listEveConversations(
  ownerId: string,
  { search = "", cursor, projectId }: EveHistoryInput = { search: "" }
) {
  const title = sql<string>`coalesce(${eveConversation.title}, left(${eveConversation.firstMessage}, 100))`;
  // Preserve PostgreSQL's microseconds: converting the cursor to Date can skip
  // conversations sharing the same millisecond at a page boundary.
  const updatedAt = sql<string>`to_char(${eveConversation.updatedAt}, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
  const beforeCursor = cursor
    ? or(
        cursor.isPinned ? eq(eveConversation.isPinned, false) : undefined,
        and(
          eq(eveConversation.isPinned, cursor.isPinned),
          or(
            sql`${eveConversation.updatedAt} < ${cursor.updatedAt}::timestamp`,
            and(
              sql`${eveConversation.updatedAt} = ${cursor.updatedAt}::timestamp`,
              lt(eveConversation.id, cursor.id)
            )
          )
        )
      )
    : undefined;
  const matchesProject = projectId
    ? eq(eveConversationProject.projectId, projectId)
    : isNull(eveConversationProject.projectId);
  const escapedSearch = search.replace(/[\\%_]/g, "\\$&");
  const rows = await db
    .select({
      id: eveConversation.id,
      title,
      projectId: eveConversationProject.projectId,
      isPinned: eveConversation.isPinned,
      updatedAt,
    })
    .from(eveConversation)
    .leftJoin(
      eveConversationProject,
      eq(eveConversationProject.conversationId, eveConversation.id)
    )
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        visibleConversation,
        projectId === undefined ? undefined : matchesProject,
        search ? ilike(title, `%${escapedSearch}%`) : undefined,
        beforeCursor
      )
    )
    .orderBy(
      desc(eveConversation.isPinned),
      desc(eveConversation.updatedAt),
      desc(eveConversation.id)
    )
    .limit(51);
  const page = rows.slice(0, 50);
  const last = page.at(-1);
  return {
    items: page.map(
      ({ id, title: itemTitle, isPinned, projectId: assignedProjectId }) => ({
        id,
        title: itemTitle,
        isPinned,
        projectId: assignedProjectId,
      })
    ),
    nextCursor:
      rows.length > 50 && last
        ? { id: last.id, isPinned: last.isPinned, updatedAt: last.updatedAt }
        : null,
  };
}
export async function getEveConversation(ownerId: string, id: string) {
  const [row] = await db
    .select()
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.id, id),
        visibleConversation
      )
    )
    .limit(1);
  return row;
}
export class CreationConflict extends Error {}

function assertCreationAvailable(
  state: typeof eveConversation.$inferSelect.state
) {
  if (state === "deleting" || state === "deleted") {
    throw new CreationConflict("This conversation can no longer be created.");
  }
}

function boundConversation(
  row: typeof eveConversation.$inferSelect | undefined
) {
  return row?.state === "bound" && row.sessionId
    ? { id: row.id, sessionId: row.sessionId }
    : undefined;
}

export async function getEveCreation(ownerId: string, operationId: string) {
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
}

export class CreationProjectNotFound extends Error {}

async function reserveEveConversation(
  value: typeof eveConversation.$inferInsert,
  fork?: EveForkInput
) {
  return await db.transaction(async (tx) => {
    // Shared with deletion: a new fork cannot appear behind its family fence.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${value.ownerId}`}, 0))`
    );
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
      throw new CreationConflict(
        "The source conversation is not available for editing."
      );
    }
    const rows = await tx
      .insert(eveConversation)
      .values({
        ...value,
        parentConversationId: fork?.conversationId,
        rootConversationId: source
          ? (source.rootConversationId ?? source.id)
          : undefined,
        forkTurnId: fork?.beforeTurnId,
      })
      .onConflictDoNothing()
      .returning();
    const created = rows[0];
    if (created && value.initialProjectId) {
      await assignCreationProject(
        tx,
        created.id,
        value.ownerId,
        value.initialProjectId
      );
    }
    if (created && source) {
      const [assignment] = await tx
        .select({ projectId: project.id })
        .from(project)
        .innerJoin(
          eveConversationProject,
          eq(eveConversationProject.projectId, project.id)
        )
        .where(eq(eveConversationProject.conversationId, source.id))
        .for("key share", { of: project });
      if (assignment) {
        await tx.insert(eveConversationProject).values({
          conversationId: created.id,
          ownerId: value.ownerId,
          projectId: assignment.projectId,
        });
      }
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
            key,
            ownerId: value.ownerId,
            conversationId: created.id,
          }))
        );
      }
    }
    return rows;
  });
}

async function assignCreationProject(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  conversationId: string,
  ownerId: string,
  projectId: string
) {
  const [target] = await tx
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, ownerId)))
    .for("key share");
  if (!target) {
    throw new CreationProjectNotFound("Project not found.");
  }
  await tx
    .insert(eveConversationProject)
    .values({ conversationId, ownerId, projectId: target.id });
}

/** Fence one conversation family; retirement and physical purge must finish separately. */
export async function beginEveConversationDeletion(
  ownerId: string,
  id: string
) {
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [source] = await tx
      .select()
      .from(eveConversation)
      .where(
        and(eq(eveConversation.id, id), eq(eveConversation.ownerId, ownerId))
      );
    if (!source) {
      return undefined;
    }
    const rootId = source.rootConversationId ?? source.id;
    const familyCondition = and(
      eq(eveConversation.ownerId, ownerId),
      or(
        eq(eveConversation.id, rootId),
        eq(eveConversation.rootConversationId, rootId)
      )
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
      throw new CreationConflict(
        "Finish recovering conversation creation before deleting this conversation."
      );
    }
    // Document writers hold this same lock through their commit. Once the fence
    // commits, later writers fail their bound-conversation check.
    for (const row of family) {
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
    conversations.sort((left, right) => left.id.localeCompare(right.id));
    return { rootId, conversations };
  });
}

/** The dispatcher must use the supplied reservation ID as Eve's idempotency key. */
export async function createEveConversation(
  ownerId: string,
  operationId: string,
  message: string,
  create: (id: string) => Promise<string>,
  {
    initialModelId,
    initialContentHash,
    fork,
    fileKeys = [],
    initialProjectId,
  }: {
    initialModelId?: string;
    initialContentHash?: string;
    fork?: EveForkInput;
    fileKeys?: string[];
    initialProjectId?: string;
  } = {}
) {
  if (fork && initialProjectId) {
    throw new CreationConflict(
      "Forks inherit their source conversation project."
    );
  }
  let [reservation] = await reserveEveConversation(
    {
      ownerId,
      operationId,
      firstMessage: message,
      initialModelId,
      initialContentHash,
      initialProjectId,
    },
    fork
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
      existing.firstMessage !== message ||
      existing.initialModelId !== (initialModelId ?? null) ||
      existing.initialContentHash !== (initialContentHash ?? null) ||
      existing.initialProjectId !== (initialProjectId ?? null) ||
      existing.parentConversationId !== (fork?.conversationId ?? null) ||
      existing.forkTurnId !== (fork?.beforeTurnId ?? null)
    ) {
      throw new CreationConflict(
        "This operation already has a different message, attachments, model, project, or source turn."
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
      const [lock] = await tx.execute<{ locked: boolean }>(
        sql`select pg_try_advisory_xact_lock(hashtextextended(${`eve-create:${reservation.id}`}, 0)) as locked`
      );
      if (!lock?.locked) {
        throw new CreationConflict(
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
          (current.state === "creating" || current.state === "uncertain")
        )
      ) {
        throw new CreationConflict(
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
      return { id: bound.id, sessionId: bound.sessionId };
    });
  } catch (cause) {
    if (cause instanceof CreationConflict) {
      throw cause;
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
    throw cause;
  }
}

export async function listEveOwnerBindings(ownerId: string) {
  return await db
    .select({
      sessionId: eveConversation.sessionId,
      state: eveConversation.state,
    })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        ne(eveConversation.state, "deleted")
      )
    );
}

export async function updateEveConversationMetadata(
  ownerId: string,
  id: string,
  updates: {
    title?: string;
    isPinned?: boolean;
    visibility?: "private" | "public";
  }
) {
  const [row] = await db
    .update(eveConversation)
    .set(updates)
    .where(
      and(
        eq(eveConversation.id, id),
        eq(eveConversation.ownerId, ownerId),
        visibleConversation
      )
    )
    .returning({ id: eveConversation.id });
  return row;
}

export async function recordEveConversationActivity(
  ownerId: string,
  sessionId: string,
  at: Date
) {
  await db
    .update(eveConversation)
    .set({ updatedAt: at })
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.sessionId, sessionId),
        visibleConversation,
        lt(eveConversation.updatedAt, at)
      )
    );
}

export async function getPublicEveConversation(id: string) {
  const [row] = await db
    .select()
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, id),
        eq(eveConversation.visibility, "public"),
        eq(eveConversation.state, "bound")
      )
    )
    .limit(1);
  return row;
}

export async function listEveConversationBranches(
  ownerId: string,
  conversationId: string
) {
  const conversation = await getEveConversation(ownerId, conversationId);
  if (!conversation) {
    return undefined;
  }
  const rootId = conversation.rootConversationId ?? conversation.id;
  const branches = await db
    .select({
      id: eveConversation.id,
      parentConversationId: eveConversation.parentConversationId,
      forkTurnId: eveConversation.forkTurnId,
      firstMessage: eveConversation.firstMessage,
      createdAt: eveConversation.createdAt,
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
    )
    .orderBy(eveConversation.createdAt, eveConversation.id);
  return { rootId, branches };
}

/** Internal cleanup only; does not grant browser or conversation access. */
export async function getDeletingEveConversationForSession(
  ownerId: string,
  sessionId: string
) {
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
}

export async function getEveConversationProject(
  ownerId: string,
  conversationId: string
) {
  const [assigned] = await db
    .select({
      id: project.id,
      name: project.name,
      instructions: project.instructions,
    })
    .from(eveConversationProject)
    .innerJoin(
      eveConversation,
      eq(eveConversation.id, eveConversationProject.conversationId)
    )
    .innerJoin(project, eq(project.id, eveConversationProject.projectId))
    .where(
      and(
        eq(eveConversationProject.conversationId, conversationId),
        eq(eveConversationProject.ownerId, ownerId),
        inArray(eveConversation.state, ["creating", "bound", "uncertain"])
      )
    );
  return assigned ?? null;
}
