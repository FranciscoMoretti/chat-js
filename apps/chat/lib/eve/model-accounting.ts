import type { DynamicModelContext } from "eve";
import { turn } from "eve/events";

import { eveModelLedger } from "@/lib/db/eve-model-ledger";
import { registerEveSubagent } from "@/lib/db/eve-subagents";

import { resolveEveConversationScope } from "./conversation-scope";
import { wrapEveModel } from "./model-ledger";
import type { ModelCallScope } from "./model-ledger";
import { resolveEveModel } from "./model-selection";

const BINDING_TIMEOUT_MS = 10_000;

const accountEveModel = (
  resolved: Awaited<ReturnType<typeof resolveEveModel>>,
  scope: ModelCallScope
): Awaited<ReturnType<typeof resolveEveModel>> => ({
  ...resolved,
  model: wrapEveModel(resolved.model, scope, eveModelLedger),
});
const resolveAccountedEveModel = async (
  requestedId: string | undefined,
  context: Pick<DynamicModelContext, "session" | "turn" | "view">
): Promise<Awaited<ReturnType<typeof resolveEveModel>>> => {
  const { parent } = context.session;
  const ownerId = context.session.auth.initiator?.principalId;
  if (typeof ownerId !== "string" || ownerId === "") {
    throw new Error("Model accounting lifecycle binding is unavailable.");
  }
  // The initial root delivery hook can bind before the HTTP response arrives.
  // Children use their trusted lineage instead of an inherited reservation.
  await (parent
    ? registerEveSubagent(
        ownerId,
        parent.sessionId,
        context.session.id,
        parent.turn.id
      )
    : resolveEveConversationScope(
        ownerId,
        context.session.id,
        AbortSignal.timeout(BINDING_TIMEOUT_MS),
        context.session.auth.initiator?.attributes.chatjsReservationId
      ));
  return accountEveModel(await resolveEveModel(requestedId), {
    ownerId,
    sessionId: context.session.id,
    ...(context.turn?.status === "running" &&
    turn(context.view, context.turn.id)?.status === "running"
      ? { turnId: context.turn.id }
      : {}),
  });
};

export { accountEveModel, resolveAccountedEveModel };
