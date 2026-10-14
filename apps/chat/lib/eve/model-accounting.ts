import type { DynamicResolveContext } from "eve";
import type { MessageStreamEvent } from "eve/client";
import { defineState } from "eve/context";
import { z } from "zod";

import {
  assertEveModelCostsKnown,
  eveModelLedger,
  getEveModelAccountingState,
} from "@/lib/db/eve-model-ledger";
import { getEveSubagent, registerEveSubagent } from "@/lib/db/eve-subagents";

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
const stepEvent = z.object({
  data: z.object({ turnId: z.string() }),
  type: z.literal("step.started"),
});
const BINDING_TIMEOUT_MS = 10_000;

const observeEveModelAccounting = (
  event: { readonly type: MessageStreamEvent["type"]; readonly data?: unknown },
  session: Pick<AccountingState, "parent"> & { readonly id: string }
): void => {
  if (event.type === "session.started") {
    accounting.update(() => ({
      openTurns: [],
      parent: session.parent,
      sessionId: session.id,
    }));
  }
  if (
    event.type === "turn.started" ||
    event.type === "turn.completed" ||
    event.type === "turn.failed" ||
    event.type === "turn.cancelled"
  ) {
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

const accountEveModel = async (
  resolved: Awaited<ReturnType<typeof resolveEveModel>>,
  scope: ModelCallScope
): Promise<Awaited<ReturnType<typeof resolveEveModel>>> => {
  const child = await getEveSubagent(scope.ownerId, scope.sessionId);
  const authority = await getEveModelAccountingState(
    scope.ownerId,
    child?.rootSessionId ?? scope.sessionId
  );
  if (authority !== "wrapper") {
    throw new Error(
      "Prelaunch model accounting requires retirement preparation."
    );
  }
  if (
    typeof child?.rootSessionId !== "string" &&
    typeof scope.turnId !== "string"
  ) {
    await assertEveModelCostsKnown(scope.ownerId);
  }
  return {
    ...resolved,
    model: wrapEveModel(resolved.model, scope, eveModelLedger),
  };
};
const resolveAccountedEveModel = async (
  requestedId: string | undefined,
  rawEvent: unknown,
  context: DynamicResolveContext
): Promise<Awaited<ReturnType<typeof resolveEveModel>>> => {
  const event = stepEvent.parse(rawEvent);
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
        context.abortSignal ?? AbortSignal.timeout(BINDING_TIMEOUT_MS),
        context.session.auth.initiator?.attributes.chatjsReservationId
      ));
  return await accountEveModel(await resolveEveModel(requestedId), {
    ownerId,
    sessionId: context.session.id,
    ...(state.openTurns.includes(event.data.turnId)
      ? { turnId: event.data.turnId }
      : {}),
  });
};

export { accountEveModel, observeEveModelAccounting, resolveAccountedEveModel };
