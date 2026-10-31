import type { DynamicModelContext } from "eve";
import type { SessionStreamEvent } from "eve/client";
import { defineState } from "eve/context";
import { z } from "zod";

import { eveModelLedger } from "@/lib/db/eve-model-ledger";
import { registerEveSubagent } from "@/lib/db/eve-subagents";

import { resolveEveConversationScope } from "./conversation-scope";
import { wrapEveModel } from "./model-ledger";
import type { ModelCallScope } from "./model-ledger";
import { resolveEveModel } from "./model-selection";

interface AccountingState {
  readonly sessionId: string;
  readonly openTurns: readonly string[];
  readonly parent?: {
    readonly sessionId: string;
    readonly turn: { readonly id: string };
  };
}

const accounting = defineState<AccountingState>(
  "chatjs.model-accounting",
  () => ({
    openTurns: [],
    sessionId: "",
  })
);
const BINDING_TIMEOUT_MS = 10_000;

const observeEveModelAccounting = (
  event: { readonly type: SessionStreamEvent["type"]; readonly data?: unknown },
  session: Pick<AccountingState, "parent"> & { readonly id: string }
): void => {
  if (event.type === "session.started") {
    accounting.update(() => ({
      openTurns: [],
      parent: session.parent,
      sessionId: session.id,
    }));
  }
  if (event.type === "turn.started" || event.type === "turn.settled") {
    const { turnId } = z.object({ turnId: z.string() }).parse(event.data);
    accounting.update((current) => {
      const remaining =
        current.sessionId === session.id
          ? current.openTurns.filter((id) => id !== turnId)
          : [];
      const openTurns =
        event.type === "turn.started" ? [...remaining, turnId] : remaining;
      return { openTurns, parent: session.parent, sessionId: session.id };
    });
  }
};

const accountEveModel = (
  resolved: Awaited<ReturnType<typeof resolveEveModel>>,
  scope: ModelCallScope
): Awaited<ReturnType<typeof resolveEveModel>> => ({
  ...resolved,
  model: wrapEveModel(resolved.model, scope, eveModelLedger),
});
const resolveAccountedEveModel = async (
  requestedId: string | undefined,
  context: DynamicModelContext
): Promise<Awaited<ReturnType<typeof resolveEveModel>>> => {
  const state = accounting.get();
  const ownerId = context.session.auth.initiator?.principalId;
  if (typeof ownerId !== "string" || ownerId === "") {
    throw new Error("Model accounting lifecycle binding is unavailable.");
  }
  if (state.sessionId !== context.session.id) {
    throw new Error("Model accounting lifecycle binding is unavailable.");
  }
  // Initial native creation can reach the model before HTTP binding. The scope
  // resolver verifies the native operation receipt; children use trusted lineage.
  await (state.parent
    ? registerEveSubagent(
        ownerId,
        state.parent.sessionId,
        context.session.id,
        state.parent.turn.id
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
    state.openTurns.includes(context.turn.id)
      ? { turnId: context.turn.id }
      : {}),
  });
};

export { accountEveModel, observeEveModelAccounting, resolveAccountedEveModel };
