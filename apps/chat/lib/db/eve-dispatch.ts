import { isNonEmptyString } from "@/lib/is-non-empty-string";
import { isDeepStrictEqual } from "node:util";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./client";
import { eveConversation, eveDispatch } from "./schema";

const hasRow: (row: unknown) => boolean = Boolean;

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
  readonly conversationId: string;
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
    existing.conversationId !== input.conversationId ||
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

/** Commits intent before the one allowed dispatch; worker failure leaves it unknown. */
export const dispatchEveOnce = async (
  input: {
    readonly ownerId: string;
    readonly operationId: string;
    readonly conversationId: string;
    readonly kind: "create" | "copy" | "send";
    readonly intent: unknown;
  },
  dispatch: () => Promise<{ sessionId: string; deliveryId?: string }>
): Promise<{ sessionId: string; deliveryId?: string }> => {
  const [conversation] = await db
    .select({ id: eveConversation.id })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, input.conversationId),
        eq(eveConversation.ownerId, input.ownerId)
      )
    );
  if (!hasRow(conversation)) {
    throw new Error("Conversation not found.");
  }
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- Match JSON persistence semantics, including omission of undefined object fields.
  const intent: unknown = JSON.parse(JSON.stringify(input.intent));
  const [claimed] = await db
    .insert(eveDispatch)
    .values({ ...input, intent })
    .onConflictDoNothing()
    .returning();
  const identity = and(
    eq(eveDispatch.ownerId, input.ownerId),
    eq(eveDispatch.operationId, input.operationId)
  );
  if (!hasRow(claimed)) {
    const existing = await readEveDispatch(input);
    if (existing) {
      return existing;
    }
    throw new EveDispatchUnknownError();
  }
  const binding = await dispatch();
  if (
    !isNonEmptyString(binding.sessionId) ||
    (input.kind === "send" && !isNonEmptyString(binding.deliveryId))
  ) {
    throw new EveDispatchUnknownError();
  }
  const [saved] = await db
    .update(eveDispatch)
    .set(binding)
    .where(and(identity, isNull(eveDispatch.sessionId)))
    .returning();
  if (!hasRow(saved)) {
    throw new EveDispatchUnknownError();
  }
  return binding;
};
