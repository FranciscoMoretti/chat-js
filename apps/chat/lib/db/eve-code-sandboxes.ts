import type { SandboxScope } from "@chat-js/sandboxes/provider";
import { and, eq, sql } from "drizzle-orm";

import { eveCodeSandboxName } from "@/lib/eve/code-sandbox-name";

import { db } from "./client";
import { eveCodeSandbox, eveConversation } from "./schema";

const FIRST_ROW_INDEX = 0;
const EMPTY_RESULT_COUNT = 0;

type SandboxTransaction = Readonly<
  Pick<typeof db, "execute" | "select" | "insert">
>;

type CodeSandboxForDeletion = Pick<
  typeof eveCodeSandbox.$inferSelect,
  "callId" | "conversationId" | "creationConfirmed" | "name"
> &
  Pick<typeof eveConversation.$inferSelect, "sessionId">;

/** Commit intent before provider I/O; no resource may be allocated by this function.
 * @param {string} ownerId Owner whose conversation family is locked during reservation.
 * @param {string} conversationId Bound conversation that will own the sandbox.
 * @param {string} callId Tool call whose existing allocation must be reconciled before any retry.
 * @param {SandboxScope} provider Sandbox provider coordinates used to derive the sandbox name.
 * @returns {Promise<string>} The durably reserved provider resource name.
 */
const reserveEveCodeSandbox = async (
  ownerId: string,
  conversationId: string,
  callId: string,
  provider: SandboxScope
): Promise<string> =>
  await db.transaction(async (tx: SandboxTransaction) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const conversationRows = await tx
      .select({ sessionId: eveConversation.sessionId })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.state, "bound")
        )
      );
    const conversation = conversationRows.at(FIRST_ROW_INDEX);
    const sessionId = conversation?.sessionId ?? "";
    if (sessionId === "") {
      throw new Error("Conversation is unavailable for code execution.");
    }
    const existingRows = await tx
      .select({ name: eveCodeSandbox.name })
      .from(eveCodeSandbox)
      .where(
        and(
          eq(eveCodeSandbox.ownerId, ownerId),
          eq(eveCodeSandbox.conversationId, conversationId),
          eq(eveCodeSandbox.callId, callId)
        )
      );
    const existing = existingRows.at(FIRST_ROW_INDEX);
    if (existing) {
      throw new Error(
        "Reconcile the existing code sandbox before retrying allocation."
      );
    }
    const name = eveCodeSandboxName({
      callId,
      ownerId,
      provider,
      sessionId,
    });
    const insertedRows = await tx
      .insert(eveCodeSandbox)
      .values({ callId, conversationId, name, ownerId })
      .onConflictDoNothing()
      .returning({ name: eveCodeSandbox.name });
    const inserted = insertedRows.at(FIRST_ROW_INDEX);
    // Retrying provider creation is unsafe until the earlier allocation is reconciled.
    if (!inserted) {
      throw new Error(
        "Reconcile the existing code sandbox before retrying allocation."
      );
    }
    return inserted.name;
  });

/** Internal coordinator only: caller must prove no pending allocation can finish later.
 * @param {string} ownerId Owner whose sandbox allocation may be marked deleted.
 * @param {string} conversationId Conversation that owns the allocation.
 * @param {string} name Reserved provider resource name confirmed deleted by the coordinator.
 */
const recordEveCodeSandboxDeletion = async (
  ownerId: string,
  conversationId: string,
  name: string
): Promise<void> => {
  const rows = await db
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
  const row = rows.at(FIRST_ROW_INDEX);
  if (!row) {
    throw new Error("Code sandbox ownership not found.");
  }
};
/** A successful create reply proves this invocation has finished allocating.
 * @param {string} ownerId Owner whose unresolved allocation may be confirmed.
 * @param {string} conversationId Conversation that owns the allocation.
 * @param {string} name Reserved provider resource name successfully created.
 */
const confirmEveCodeSandboxCreation = async (
  ownerId: string,
  conversationId: string,
  name: string
): Promise<void> => {
  const rows = await db
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
  const row = rows.at(FIRST_ROW_INDEX);
  if (!row) {
    throw new Error("Unresolved code sandbox ownership not found.");
  }
};

const listEveCodeSandboxesForDeletion = async (
  ownerId: string,
  rootId: string
): Promise<CodeSandboxForDeletion[]> => {
  const family = await db
    .select({
      id: eveConversation.id,
      state: eveConversation.state,
    })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.chatId, rootId)
      )
    );
  if (
    family.length === EMPTY_RESULT_COUNT ||
    family.some((row) => row.state !== "deleting" && row.state !== "deleted")
  ) {
    throw new Error(
      "Retire the conversation family before code sandbox cleanup."
    );
  }
  return await db
    .select({
      callId: eveCodeSandbox.callId,
      conversationId: eveCodeSandbox.conversationId,
      creationConfirmed: eveCodeSandbox.creationConfirmed,
      name: eveCodeSandbox.name,
      sessionId: eveConversation.sessionId,
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
        eq(eveConversation.chatId, rootId)
      )
    );
};

export {
  confirmEveCodeSandboxCreation,
  listEveCodeSandboxesForDeletion,
  recordEveCodeSandboxDeletion,
  reserveEveCodeSandbox,
};
