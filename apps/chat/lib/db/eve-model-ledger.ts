import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";

import { modelReceiptCost } from "@/lib/eve/model-ledger";
import type { ModelAttempt, ModelLedger } from "@/lib/eve/model-ledger";

import { db } from "./client";
import { recordEveUsage } from "./eve-billing";
import { getEveSubagent } from "./eve-subagents";
import { eveConversation, eveUsage } from "./schema";

// Maintenance has no user turn. Never assign it the next EVE turn ID.
const MAINTENANCE_TURN = "chatjs:maintenance";
const SINGLE_MATCH = 1;
const FIRST_MATCH = 0;
const storedAttempt = z.object({
  eventId: z.string(),
  modelId: z.string(),
  ownerId: z.string(),
  provider: z.string(),
  sessionId: z.string(),
  turnId: z.string().optional(),
});

const getEveModelAccountingState = async (
  ownerId: string,
  sessionId: string
): Promise<"unprepared" | "wrapper" | "retired"> => {
  const bindings = await db
    .select({ authority: eveConversation.modelAccountingState })
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
  return binding.authority;
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
  if (
    (await getEveModelAccountingState(attempt.ownerId, sessionId)) !== "wrapper"
  ) {
    throw new Error(
      "Model ledger is not the billing authority for this conversation."
    );
  }
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
        state: "returned",
        usage: receipt.usage,
      },
    });
  },
};

const assertEveModelAccountingPrepared = async (
  ownerId: string
): Promise<void> => {
  const unprepared = await db
    .select({ id: eveConversation.id })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.modelAccountingState, "unprepared")
      )
    )
    .limit(SINGLE_MATCH);
  if (unprepared.at(FIRST_MATCH)) {
    throw new Error(
      "Prelaunch accounting must be prepared before starting more work."
    );
  }
};

const assertEveModelCostsKnown = async (ownerId: string): Promise<void> => {
  await assertEveModelAccountingPrepared(ownerId);
  const unpriced = await db
    .select({ id: eveUsage.eventId })
    .from(eveUsage)
    .where(and(eq(eveUsage.ownerId, ownerId), isNull(eveUsage.costUsd)))
    .limit(SINGLE_MATCH);
  if (unpriced.at(FIRST_MATCH)) {
    throw new Error(
      "Model usage needs provider cost reconciliation before starting more work."
    );
  }
};

export {
  assertEveModelAccountingPrepared,
  assertEveModelCostsKnown,
  eveModelLedger,
  getEveModelAccountingState,
};
