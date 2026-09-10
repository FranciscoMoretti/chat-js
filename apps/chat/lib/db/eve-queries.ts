import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { eveConversation } from "@/lib/db/schema";
import type { EveForkInput } from "@/lib/eve/contracts";
import type { EveHistoryInput } from "@/lib/eve/history-input";
import { initializeEveForkDocuments } from "./eve-documents";

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
  { search = "", cursor }: EveHistoryInput = { search: "" }
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
  const escapedSearch = search.replace(/[\\%_]/g, "\\$&");
  const rows = await db
    .select({
      id: eveConversation.id,
      title,
      isPinned: eveConversation.isPinned,
      updatedAt,
    })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
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
    items: page.map(({ id, title: itemTitle, isPinned }) => ({
      id,
      title: itemTitle,
      isPinned,
      projectId: null,
    })),
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
      and(eq(eveConversation.ownerId, ownerId), eq(eveConversation.id, id))
    )
    .limit(1);
  return row;
}
export class CreationConflict extends Error {}

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

export async function createEveConversation(
  ownerId: string,
  operationId: string,
  message: string,
  create: (id: string) => Promise<string>,
  initialModelId?: string,
  initialContentHash?: string,
  fork?: EveForkInput
) {
  const source = fork
    ? await getEveConversation(ownerId, fork.conversationId)
    : undefined;
  if (fork && (!source?.sessionId || source.state !== "bound")) {
    throw new CreationConflict(
      "The source conversation is not available for editing."
    );
  }
  const rootConversationId = source
    ? (source.rootConversationId ?? source.id)
    : undefined;
  const [reservation] = await db
    .insert(eveConversation)
    .values({
      ownerId,
      operationId,
      firstMessage: message,
      initialModelId,
      initialContentHash,
      parentConversationId: fork?.conversationId,
      rootConversationId,
      forkTurnId: fork?.beforeTurnId,
    })
    .onConflictDoNothing()
    .returning();
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
    if (
      !existing ||
      existing.firstMessage !== message ||
      existing.initialModelId !== (initialModelId ?? null) ||
      existing.initialContentHash !== (initialContentHash ?? null) ||
      existing.parentConversationId !== (fork?.conversationId ?? null) ||
      existing.forkTurnId !== (fork?.beforeTurnId ?? null)
    ) {
      throw new CreationConflict(
        "This operation already has a different message, attachments, model, or source turn."
      );
    }
    if (existing.state !== "bound" || !existing.sessionId) {
      throw new CreationConflict(
        "Creation is unresolved. Keep this operation for reconciliation; do not send it as a new conversation."
      );
    }
    return { id: existing.id, sessionId: existing.sessionId };
  }
  try {
    if (fork) {
      await initializeEveForkDocuments(ownerId, reservation.id);
    }
    const sessionId = await create(reservation.id);
    const [bound] = await db
      .update(eveConversation)
      .set({ sessionId, state: "bound" })
      .where(eq(eveConversation.id, reservation.id))
      .returning();
    if (!bound?.sessionId) {
      throw new Error("Session binding was not saved.");
    }
    return { id: bound.id, sessionId: bound.sessionId };
  } catch (cause) {
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
    .where(eq(eveConversation.ownerId, ownerId));
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
      and(eq(eveConversation.id, id), eq(eveConversation.ownerId, ownerId))
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
