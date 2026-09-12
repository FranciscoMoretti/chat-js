import { and, eq, sql } from "drizzle-orm";
import { eveCodeSandboxName } from "../eve/code-sandbox-name";
import { db } from "./client";
import { eveCodeSandbox, eveConversation } from "./schema";

/** Commit intent before provider I/O; no resource may be allocated by this function. */
export async function reserveEveCodeSandbox(
  ownerId: string,
  conversationId: string,
  callId: string
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
    const name = eveCodeSandboxName({
      ownerId,
      sessionId: conversation.sessionId,
      callId,
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
