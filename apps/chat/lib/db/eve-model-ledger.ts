import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { modelReceiptCost } from "@/lib/eve/model-ledger";
import type { ModelAttempt, ModelLedger } from "@/lib/eve/model-ledger";

import { db } from "./client";
import { recordEveUsage } from "./eve-billing";
import { getEveSubagent } from "./eve-subagents";
import { eveConversation, eveUsage } from "./schema";

// Maintenance has no user turn. Never assign it the next EVE turn ID.
const MAINTENANCE_TURN = "chatjs:maintenance";
const FIRST_MATCH = 0;
const storedAttempt = z.object({
  eventId: z.string(),
  modelId: z.string(),
  ownerId: z.string(),
  provider: z.string(),
  sessionId: z.string(),
  turnId: z.string().optional(),
});

const assertOwnedModelConversation = async (
  ownerId: string,
  sessionId: string
): Promise<void> => {
  const bindings = await db
    .select({ id: eveConversation.id })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.sessionId, sessionId),
        eq(eveConversation.state, "bound")
      )
    );
  const binding = bindings.at(FIRST_MATCH);
  if (!binding) {
    throw new Error("Model accounting requires an owned conversation binding.");
  }
};

const modelBillingIdentity = async (
  attempt: ModelAttempt
): Promise<{
  ownerId: string;
  sessionId: string;
  turnId: string;
  eventId: string;
}> => {
  const child = await getEveSubagent(attempt.ownerId, attempt.sessionId);
  const sessionId = child?.rootSessionId ?? attempt.sessionId;
  await assertOwnedModelConversation(attempt.ownerId, sessionId);
  return {
    eventId: attempt.eventId,
    ownerId: attempt.ownerId,
    sessionId,
    turnId: child?.rootTurnId ?? attempt.turnId ?? MAINTENANCE_TURN,
  };
};

const readModelIntent = async (attempt: ModelAttempt) => {
  // Read the persisted intent: deletion or lineage changes must not reattribute spend.
  const intents = await db
    .select()
    .from(eveUsage)
    .where(
      and(
        eq(eveUsage.eventId, attempt.eventId),
        eq(eveUsage.ownerId, attempt.ownerId),
        isNotNull(eveUsage.modelAttempt)
      )
    );
  const intent = intents.at(FIRST_MATCH);
  if (!intent) {
    throw new Error("Model receipt has no durable intent.");
  }
  const identity = storedAttempt.parse(intent.modelAttempt);
  if (
    identity.eventId !== attempt.eventId ||
    identity.ownerId !== attempt.ownerId ||
    identity.sessionId !== attempt.sessionId ||
    identity.turnId !== attempt.turnId ||
    identity.modelId !== attempt.modelId ||
    identity.provider !== attempt.provider
  ) {
    throw new Error("Model receipt identity conflict.");
  }
  return { intent, identity };
};

const eveModelLedger: ModelLedger = {
  async authorize(attempt) {
    await modelBillingIdentity(attempt);
  },
  async begin(attempt) {
    const identity = await modelBillingIdentity(attempt);
    await recordEveUsage({
      ...identity,
      modelAttempt: { ...attempt, state: "pending" },
    });
  },
  async observe(attempt, response) {
    const { intent, identity } = await readModelIntent(attempt);
    await recordEveUsage({
      eventId: intent.eventId,
      ownerId: intent.ownerId,
      sessionId: intent.sessionId,
      turnId: intent.turnId,
      modelAttempt: { ...identity, state: "pending", response },
    });
  },
  async finish(attempt, receipt) {
    const { intent, identity } = await readModelIntent(attempt);
    const generationId = receipt.providerMetadata?.gateway?.generationId;
    await recordEveUsage({
      costUsd: modelReceiptCost(receipt),
      eventId: intent.eventId,
      ownerId: intent.ownerId,
      sessionId: intent.sessionId,
      turnId: intent.turnId,
      ...(typeof generationId === "string" ? { generationId } : {}),
      modelAttempt: {
        ...identity,
        providerMetadata: receipt.providerMetadata,
        response: receipt.response,
        state: "returned",
        usage: receipt.usage,
      },
    });
  },
};

export { eveModelLedger };
