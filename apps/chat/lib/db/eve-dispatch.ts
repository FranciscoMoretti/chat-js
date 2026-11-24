import { isNonEmptyString } from "@/lib/is-non-empty-string";
import { isDeepStrictEqual } from "node:util";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import { eveConversation, eveDispatch, eveWorkspace } from "./schema";
import {
  EveWorkspaceBusyError,
  hasUnresolvedWorkspaceSteer,
  lockEveWorkspace,
} from "./eve-workspace-turns";
import type { WorkspaceTransaction } from "./eve-workspace-turns";
import { reconcileEveWorkspaceTurn } from "../eve/reconcile-workspace-turn";
import { z } from "zod";
import { frontendToolsSchema } from "@/lib/ai/types";
import { parseEveCopySeed } from "@/lib/eve/copy-seed";
import { eveMessageTool } from "@/lib/eve/message-tool-selection";
import type { EveMessageDisplayReceipt } from "@/lib/eve/message-display";
import { EveSteerRejectedError } from "@/lib/eve/steer-rejected";

const hasRow: (row: unknown) => boolean = Boolean;

/** Display-only fields from known message bindings; unknown and foreign bindings are omitted. */
export const getEveMessageDisplayReceipts = async (
  ownerId: string,
  sessionId: string,
  database: Pick<typeof db, "select"> = db
): Promise<EveMessageDisplayReceipt[]> => {
  const rows = await database
    .select({
      deliveryId: eveDispatch.deliveryId,
      intent: eveDispatch.intent,
      history: sql<unknown>`case when ${eveDispatch.kind} = 'create' then ${eveConversation.initialSeed} end`,
    })
    .from(eveDispatch)
    .innerJoin(
      eveConversation,
      and(
        eq(eveDispatch.branchId, eveConversation.id),
        eq(eveDispatch.ownerId, eveConversation.ownerId)
      )
    )
    .where(
      and(
        eq(eveDispatch.ownerId, ownerId),
        eq(eveDispatch.sessionId, sessionId),
        inArray(eveDispatch.kind, ["create", "send"]),
        eq(eveConversation.sessionId, sessionId),
        eq(eveConversation.state, "bound")
      )
    );
  return rows.flatMap((row): EveMessageDisplayReceipt[] => {
    const intent = z
      .object({ selectedTool: frontendToolsSchema.nullish() })
      .safeParse(row.intent);
    if (!intent.success) {
      return [];
    }
    const selectedTool = intent.data.selectedTool ?? null;
    return isNonEmptyString(row.deliveryId)
      ? [
          {
            kind: "send",
            deliveryId: row.deliveryId,
            selectedTool,
            ...(row.history !== null && row.history !== undefined
              ? {
                  history: parseEveCopySeed(row.history).messages.map(
                    (message) => ({
                      role: message.role,
                      ...(message.role === "assistant"
                        ? { modelId: message.modelId }
                        : {
                            selectedTool: eveMessageTool({
                              metadata: { custom: message.metadata },
                            }),
                          }),
                    })
                  ),
                }
              : {}),
          },
        ]
      : [];
  });
};

export class EveDispatchUnknownError extends Error {
  constructor() {
    super(
      "This operation may have been accepted. Its outcome is unknown; it will not be sent again."
    );
    this.name = "EveDispatchUnknownError";
  }
}

/** Reads the app journal without dispatching; a missing binding remains unknown. */
const readEveDispatch = async (input: {
  readonly ownerId: string;
  readonly operationId: string;
  readonly branchId: string;
  readonly kind: "create" | "copy" | "send";
  readonly intent: unknown;
}): Promise<{ sessionId: string; deliveryId?: string } | undefined> => {
  const [existing] = await db
    .select()
    .from(eveDispatch)
    .where(
      and(
        eq(eveDispatch.ownerId, input.ownerId),
        eq(eveDispatch.operationId, input.operationId)
      )
    );
  if (!hasRow(existing)) {
    return undefined;
  }
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- Match JSON persistence semantics, including omission of undefined object fields.
  const intent: unknown = JSON.parse(JSON.stringify(input.intent));
  if (
    existing.branchId !== input.branchId ||
    existing.kind !== input.kind ||
    !isDeepStrictEqual(existing.intent, intent)
  ) {
    throw new Error("This operation already has different intent.");
  }
  if (!isNonEmptyString(existing.sessionId)) {
    throw new EveDispatchUnknownError();
  }
  return {
    sessionId: existing.sessionId,
    ...(isNonEmptyString(existing.deliveryId)
      ? { deliveryId: existing.deliveryId }
      : {}),
  };
};

interface DispatchBinding {
  sessionId: string;
  deliveryId?: string;
}

const canSteerActiveDispatch = async (
  tx: Pick<WorkspaceTransaction, "select">,
  activeOperationId: string,
  input: {
    readonly ownerId: string;
    readonly branchId: string;
    readonly kind: "create" | "copy" | "send";
    readonly steerSessionId?: string;
  }
): Promise<boolean> => {
  if (input.kind !== "send" || !isNonEmptyString(input.steerSessionId)) {
    return false;
  }
  const [active] = await tx
    .select({ deliveryId: eveDispatch.deliveryId })
    .from(eveDispatch)
    .where(
      and(
        eq(eveDispatch.ownerId, input.ownerId),
        eq(eveDispatch.operationId, activeOperationId),
        eq(eveDispatch.branchId, input.branchId),
        eq(eveDispatch.sessionId, input.steerSessionId),
        inArray(eveDispatch.kind, ["create", "send"])
      )
    );
  return isNonEmptyString(active?.deliveryId);
};

/** Commits intent before the one allowed dispatch; worker failure leaves it unknown. */
export const dispatchEveOnce = async (
  input: {
    readonly ownerId: string;
    readonly operationId: string;
    readonly branchId: string;
    readonly kind: "create" | "copy" | "send";
    readonly intent: unknown;
    readonly steerSessionId?: string;
  },
  dispatch: (
    saveReceipt: (
      transaction: Pick<typeof db, "update">,
      binding: DispatchBinding
    ) => Promise<void>
  ) => Promise<DispatchBinding>
): Promise<DispatchBinding> => {
  const replay = await readEveDispatch(input);
  if (replay) {
    return replay;
  }
  await reconcileEveWorkspaceTurn(input.ownerId, input.branchId);
  const [conversation] = await db
    .select({
      id: eveConversation.id,
      workspaceId: eveConversation.workspaceId,
    })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, input.branchId),
        eq(eveConversation.ownerId, input.ownerId)
      )
    );
  if (!hasRow(conversation)) {
    throw new Error("Conversation not found.");
  }
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- Match JSON persistence semantics, including omission of undefined object fields.
  const intent: unknown = JSON.parse(JSON.stringify(input.intent));
  const [claimed] = await db.transaction(async (tx) => {
    // Copy capture holds this same lock while reading the native transcript and documents.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${input.ownerId}`}, 0))`
    );
    const workspace = await lockEveWorkspace(
      tx,
      input.ownerId,
      conversation.workspaceId
    );
    // Recheck under the workspace lock: another process may have claimed this exact
    // operation since the read above. Its replay must not dispatch again.
    const [existing] = await tx
      .select()
      .from(eveDispatch)
      .where(
        and(
          eq(eveDispatch.ownerId, input.ownerId),
          eq(eveDispatch.operationId, input.operationId)
        )
      );
    if (hasRow(existing)) {
      return [];
    }
    if (
      workspace.activeOperationId !== null &&
      (!(await canSteerActiveDispatch(
        tx,
        workspace.activeOperationId,
        input
      )) ||
        (await hasUnresolvedWorkspaceSteer(tx, input.ownerId, workspace.id)))
    ) {
      throw new EveWorkspaceBusyError();
    }
    const [current] = await tx
      .select({ state: eveConversation.state })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, input.branchId),
          eq(eveConversation.ownerId, input.ownerId),
          eq(eveConversation.workspaceId, workspace.id)
        )
      );
    if (
      !hasRow(current) ||
      current.state === "deleted" ||
      current.state === "deleting"
    ) {
      throw new Error("Conversation is unavailable.");
    }
    const { steerSessionId: _steerSessionId, ...journalInput } = input;
    const inserted = await tx
      .insert(eveDispatch)
      .values({ ...journalInput, intent })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 0) {
      return [];
    }
    if (workspace.activeOperationId === null) {
      await tx
        .update(eveWorkspace)
        .set({ activeOperationId: input.operationId })
        .where(eq(eveWorkspace.id, workspace.id));
    }
    return [{ previousOperationId: workspace.activeOperationId }];
  });
  const identity = and(
    eq(eveDispatch.ownerId, input.ownerId),
    eq(eveDispatch.operationId, input.operationId)
  );
  if (claimed === undefined) {
    const existing = await readEveDispatch(input);
    if (existing) {
      return existing;
    }
    throw new EveDispatchUnknownError();
  }
  const persist = async (
    database: Pick<typeof db, "update">,
    binding: DispatchBinding
  ): Promise<void> => {
    if (
      !isNonEmptyString(binding.sessionId) ||
      (input.kind === "send" && !isNonEmptyString(binding.deliveryId))
    ) {
      throw new EveDispatchUnknownError();
    }
    const [saved] = await database
      .update(eveDispatch)
      .set(binding)
      .where(and(identity, isNull(eveDispatch.sessionId)))
      .returning();
    if (!hasRow(saved)) {
      throw new EveDispatchUnknownError();
    }
  };
  const finishSteer = async (
    binding: DispatchBinding | null
  ): Promise<void> => {
    await db.transaction(async (tx) => {
      const workspace = await lockEveWorkspace(
        tx,
        input.ownerId,
        conversation.workspaceId
      );
      if (binding === null) {
        await tx
          .delete(eveDispatch)
          .where(and(identity, isNull(eveDispatch.sessionId)));
        if (workspace.activeOperationId === input.operationId) {
          await tx
            .update(eveWorkspace)
            .set({ activeOperationId: null })
            .where(eq(eveWorkspace.id, workspace.id));
        }
        return;
      }
      if (workspace.activeOperationId !== claimed.previousOperationId) {
        throw new EveDispatchUnknownError();
      }
      await persist(tx, binding);
      await tx
        .update(eveWorkspace)
        .set({ activeOperationId: input.operationId })
        .where(eq(eveWorkspace.id, workspace.id));
    });
  };
  let savedInDispatch = false;
  let binding: DispatchBinding;
  try {
    binding = await dispatch(async (transaction, receipt) => {
      if (claimed.previousOperationId !== null) {
        throw new Error(
          "Steering receipts must be saved with the workspace reservation."
        );
      }
      await persist(transaction, receipt);
      savedInDispatch = true;
    });
  } catch (error) {
    if (error instanceof EveSteerRejectedError && !savedInDispatch) {
      await finishSteer(null);
    }
    throw error;
  }
  if (claimed.previousOperationId !== null) {
    // EVE may consume a steer in the next turn. Transfer ownership only after
    // storing the receipt and keep the prior reservation through uncertainty.
    await finishSteer(binding);
    return binding;
  }
  if (!savedInDispatch) {
    await persist(db, binding);
  }
  return binding;
};

/** Returns only a positively bound send receipt owned by the current principal. */
export const getEveSendReceipt = async (
  ownerId: string,
  sessionId: string,
  operationId: string
): Promise<{
  sessionId: string;
  operationId: string;
  deliveryId: string;
} | null> => {
  const [row] = await db
    .select({
      sessionId: eveDispatch.sessionId,
      operationId: eveDispatch.operationId,
      deliveryId: eveDispatch.deliveryId,
    })
    .from(eveDispatch)
    .innerJoin(
      eveConversation,
      and(
        eq(eveDispatch.branchId, eveConversation.id),
        eq(eveDispatch.ownerId, eveConversation.ownerId)
      )
    )
    .where(
      and(
        eq(eveDispatch.ownerId, ownerId),
        eq(eveDispatch.operationId, operationId),
        eq(eveDispatch.kind, "send"),
        eq(eveDispatch.sessionId, sessionId),
        eq(eveConversation.sessionId, sessionId),
        eq(eveConversation.state, "bound")
      )
    );
  if (
    !hasRow(row) ||
    !isNonEmptyString(row.sessionId) ||
    !isNonEmptyString(row.deliveryId)
  ) {
    return null;
  }
  return {
    sessionId: row.sessionId,
    operationId: row.operationId,
    deliveryId: row.deliveryId,
  };
};

/** Serialize short native controls against completed-conversation capture. */
export const withEveCopyCaptureFence = async <Result>(
  ownerId: string,
  action: () => Promise<Result>
): Promise<Result> =>
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    return await action();
  });
