import { z } from "zod";

import {
  bindAcceptedEveConversation,
  readEveSessionMapping,
} from "../db/eve-queries";
import { eveRequest } from "./server";
import { EveSessionMappingError } from "./session-mapping-error";

const assertNativeReceipt = async (
  ownerId: string,
  reservationId: string,
  sessionId: string,
  abortSignal: AbortSignal
) => {
  let response: Response;
  try {
    response = await eveRequest(ownerId, `/eve/v1/operation/${reservationId}`, {
      signal: abortSignal,
    });
  } catch {
    abortSignal.throwIfAborted();
    throw new EveSessionMappingError("receipt_unavailable");
  }
  const body: unknown = await response.json().catch(() => null);
  if (
    response.status === 404 &&
    z.object({ code: z.literal("eve_operation_not_found") }).safeParse(body)
      .success
  ) {
    throw new EveSessionMappingError("receipt_pending");
  }
  const receipt = z.object({ sessionId: z.string().min(1) }).safeParse(body);
  if (!response.ok || !receipt.success) {
    throw new EveSessionMappingError("receipt_unavailable");
  }
  if (receipt.data.sessionId !== sessionId) {
    throw new EveSessionMappingError("binding_conflict");
  }
};

/** Auth attributes locate a reservation; only its exact native receipt authorizes binding. */
export const resolveEveConversationScope = async (
  ownerId: string | undefined,
  sessionId: string,
  abortSignal: AbortSignal,
  reservationId?: unknown
) => {
  abortSignal.throwIfAborted();
  if (!ownerId) {
    throw new EveSessionMappingError("unauthenticated");
  }
  const identity = z.uuid().optional().safeParse(reservationId);
  if (!identity.success) {
    throw new EveSessionMappingError("binding_conflict");
  }
  const row = await readEveSessionMapping(
    identity.data ? { reservationId: identity.data } : { sessionId }
  );
  if (!row) {
    throw new EveSessionMappingError(
      identity.data ? "identity_missing" : "identity_pending"
    );
  }
  if (row.ownerId !== ownerId) {
    throw new EveSessionMappingError("owner_mismatch");
  }
  if (row.state === "deleting" || row.state === "deleted") {
    throw new EveSessionMappingError("identity_deleted");
  }
  if (row.sessionId && row.sessionId !== sessionId) {
    throw new EveSessionMappingError("binding_conflict");
  }
  if (row.state === "bound") {
    if (!row.sessionId) {
      throw new EveSessionMappingError("binding_conflict");
    }
    return { conversationId: row.id, ownerId };
  }
  if (row.sessionId) {
    throw new EveSessionMappingError("binding_conflict");
  }
  // Seed acceptance has its own resource/copy journal and must finish there.
  if (row.creationKind === "copy") {
    throw new EveSessionMappingError("identity_pending");
  }
  await assertNativeReceipt(ownerId, row.id, sessionId, abortSignal);
  await bindAcceptedEveConversation(ownerId, row.id, sessionId);
  return { conversationId: row.id, ownerId };
};
