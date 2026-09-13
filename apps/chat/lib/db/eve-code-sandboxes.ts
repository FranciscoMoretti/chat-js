import { and, eq, or, sql } from "drizzle-orm";

import { eveCodeSandboxName } from "../eve/code-sandbox-name";
import { db } from "./client";
import { eveCodeSandbox, eveConversation } from "./schema";

/** Commit intent before provider I/O; no resource may be allocated by this function. */
export async function reserveEveCodeSandbox(
  ownerId: string,
  conversationId: string,
  callId: string,
  provider: { teamId: string; projectId: string }
) {
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [conversation] = await tx
      .select({ sessionId: eveConversation.sessionId })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.state, "bound")
        )
      );
    if (!conversation?.sessionId) {
      throw new Error("Conversation is unavailable for code execution.");
    }
    const [existing] = await tx
      .select({ name: eveCodeSandbox.name })
      .from(eveCodeSandbox)
      .where(
        and(
          eq(eveCodeSandbox.ownerId, ownerId),
          eq(eveCodeSandbox.conversationId, conversationId),
          eq(eveCodeSandbox.callId, callId)
        )
      );
    if (existing) {
      throw new Error(
        "Reconcile the existing code sandbox before retrying allocation."
      );
    }
    const name = eveCodeSandboxName({
      ownerId,
      sessionId: conversation.sessionId,
      callId,
      provider,
    });
    const [inserted] = await tx
      .insert(eveCodeSandbox)
      .values({ name, ownerId, conversationId, callId })
      .onConflictDoNothing()
      .returning({ name: eveCodeSandbox.name });
    // Retrying provider creation is unsafe until the earlier allocation is reconciled.
    if (!inserted) {
      throw new Error(
        "Reconcile the existing code sandbox before retrying allocation."
      );
    }
    return inserted.name;
  });
}

/** Internal coordinator only: caller must prove no pending allocation can finish later. */
export async function recordEveCodeSandboxDeletion(
  ownerId: string,
  conversationId: string,
  name: string
) {
  const [row] = await db
    .update(eveCodeSandbox)
    .set({ state: "deleted" })
    .where(
      and(
        eq(eveCodeSandbox.ownerId, ownerId),
        eq(eveCodeSandbox.conversationId, conversationId),
        eq(eveCodeSandbox.name, name)
      )
    )
    .returning({ name: eveCodeSandbox.name });
  if (!row) {
    throw new Error("Code sandbox ownership not found.");
  }
}

/** A successful create reply proves this invocation has finished allocating. */
export async function confirmEveCodeSandboxCreation(
  ownerId: string,
  conversationId: string,
  name: string
) {
  const [row] = await db
    .update(eveCodeSandbox)
    .set({ creationConfirmed: true })
    .where(
      and(
        eq(eveCodeSandbox.ownerId, ownerId),
        eq(eveCodeSandbox.conversationId, conversationId),
        eq(eveCodeSandbox.name, name),
        eq(eveCodeSandbox.state, "unresolved")
      )
    )
    .returning({ name: eveCodeSandbox.name });
  if (!row) {
    throw new Error("Unresolved code sandbox ownership not found.");
  }
}

/** Internal cleanup inventory; unretired families cannot authorize provider deletion. */
export async function listEveCodeSandboxesForDeletion(
  ownerId: string,
  rootId: string
) {
  const family = await db
    .select({
      id: eveConversation.id,
      state: eveConversation.state,
      rootId: eveConversation.rootConversationId,
    })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        or(
          eq(eveConversation.id, rootId),
          eq(eveConversation.rootConversationId, rootId)
        )
      )
    );
  if (
    !family.some((row) => row.id === rootId && row.rootId === null) ||
    family.some((row) => row.state !== "deleting" && row.state !== "deleted")
  ) {
    throw new Error(
      "Retire the conversation family before code sandbox cleanup."
    );
  }
  return await db
    .select({
      name: eveCodeSandbox.name,
      callId: eveCodeSandbox.callId,
      sessionId: eveConversation.sessionId,
      conversationId: eveCodeSandbox.conversationId,
      creationConfirmed: eveCodeSandbox.creationConfirmed,
    })
    .from(eveCodeSandbox)
    .innerJoin(
      eveConversation,
      eq(eveConversation.id, eveCodeSandbox.conversationId)
    )
    .where(
      and(
        eq(eveCodeSandbox.ownerId, ownerId),
        eq(eveCodeSandbox.state, "unresolved"),
        or(
          eq(eveConversation.id, rootId),
          eq(eveConversation.rootConversationId, rootId)
        )
      )
    );
}
