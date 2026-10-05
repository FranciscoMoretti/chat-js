import { and, eq, sql } from "drizzle-orm";

import { eveCodeSandboxName } from "@/lib/eve/code-sandbox-name";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "./client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveCodeSandbox, eveConversation } from "./schema";
/* oxlint-enable sort-imports */

const FIRST_ROW_INDEX = 0;

type SandboxTransaction = Readonly<
  Pick<typeof db, "execute" | "insert" | "select">
>;

type CodeSandboxForDeletion = Pick<
  typeof eveCodeSandbox.$inferSelect,
  "callId" | "conversationId" | "creationConfirmed" | "name"
> &
  Pick<typeof eveConversation.$inferSelect, "sessionId">;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reserveEveCodeSandbox's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-params, max-statements --
max-lines-per-function (#510): reserveEveCodeSandbox keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-params (#511): reserveEveCodeSandbox keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): reserveEveCodeSandbox keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
/** Commit intent before provider I/O; no resource may be allocated by this function.
 * @param {string} ownerId Owner whose conversation family is locked during reservation.
 * @param {string} conversationId Bound conversation that will own the sandbox.
 * @param {string} callId Tool call whose existing allocation must be reconciled before any retry.
 * @param {{ readonly teamId: string; readonly projectId: string; }} provider Vercel project and team identities used to derive the sandbox name.
 * @returns {Promise<string>} The durably reserved provider resource name.
 */
const reserveEveCodeSandbox = async (
  ownerId: string,
  conversationId: string,
  callId: string,
  provider: {
    readonly teamId: string;
    readonly projectId: string;
  }
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve recordEveCodeSandboxDeletion's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-params, max-statements */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve confirmEveCodeSandboxCreation's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve listEveCodeSandboxesForDeletion's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
no-magic-numbers (#517): listEveCodeSandboxesForDeletion uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
/** Internal cleanup inventory; unretired families cannot authorize provider deletion.
 * @param {string} ownerId Owner whose retired conversation family is being purged.
 * @param {string} rootId Logical chat identity whose versions must all be retired.
 * @returns {Promise<CodeSandboxForDeletion[]>} Owned allocations that still require provider deletion or reconciliation.
 */
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
    family.length === 0 ||
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (confirmEveCodeSandboxCreation, listEveCodeSandboxesForDeletion, recordEveCodeSandboxDeletion, reserveEveCodeSandbox); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */
export {
  confirmEveCodeSandboxCreation,
  listEveCodeSandboxesForDeletion,
  recordEveCodeSandboxDeletion,
  reserveEveCodeSandbox,
};
/* oxlint-enable import/no-named-export */
