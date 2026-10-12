import { isNonEmptyString } from "@/lib/is-non-empty-string";

import { z } from "zod";

import {
  bindAcceptedEveConversation,
  readEveSessionMapping,
} from "@/lib/db/eve-queries";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { eveRequest } from "./server";
import { EveSessionMappingError } from "./session-mapping-error";

const assertNativeReceipt = async (
  ownerId: string,
  reservationId: string,
  sessionId: string,
  abortSignal: ReadonlyNativeSurface<AbortSignal>
): Promise<void> => {
  let response: Response;
  try {
    response = await eveRequest(
      ownerId,
      `/eve/chat/v1/operation/${reservationId}`,
      {
        signal: abortSignal,
      }
    );
  } catch {
    abortSignal.throwIfAborted();
    throw new EveSessionMappingError("receipt_unavailable");
  }
  const body: unknown = await response.json().catch((): void => {
    // The required receipt schemas below reject an absent JSON body.
  });
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

/**
 * Auth attributes locate a reservation; only its exact native receipt authorizes binding.
 * @param {string | undefined} ownerId - Authenticated owner; absence raises an authentication error.
 * @param {string} sessionId - Native session identity that must match the durable binding or receipt.
 * @param {ReadonlyNativeSurface<AbortSignal>} abortSignal - Cancellation checked before lookup and after native receipt failures.
 * @param {unknown | undefined} reservationId - Optional creation UUID from auth attributes, validated before lookup.
 * @returns {Promise<{ conversationId: string; ownerId: string }>} Durable conversation identity and the authenticated owner after receipt reconciliation.
 */
export const resolveEveConversationScope = async (
  ownerId: string | undefined,
  sessionId: string,
  abortSignal: ReadonlyNativeSurface<AbortSignal>,
  reservationId?: unknown
): Promise<{ conversationId: string; ownerId: string }> => {
  abortSignal.throwIfAborted();
  if (!isNonEmptyString(ownerId)) {
    throw new EveSessionMappingError("unauthenticated");
  }
  const identity = z.uuid().optional().safeParse(reservationId);
  if (!identity.success) {
    throw new EveSessionMappingError("binding_conflict");
  }
  const row = await readEveSessionMapping(
    isNonEmptyString(identity.data)
      ? { reservationId: identity.data }
      : { sessionId }
  );
  if (!(row !== undefined)) {
    throw new EveSessionMappingError(
      isNonEmptyString(identity.data) ? "identity_missing" : "identity_pending"
    );
  }
  if (row.ownerId !== ownerId) {
    throw new EveSessionMappingError("owner_mismatch");
  }
  if (row.state === "deleting" || row.state === "deleted") {
    throw new EveSessionMappingError("identity_deleted");
  }
  if (isNonEmptyString(row.sessionId) && row.sessionId !== sessionId) {
    throw new EveSessionMappingError("binding_conflict");
  }
  if (row.state === "bound") {
    if (!isNonEmptyString(row.sessionId)) {
      throw new EveSessionMappingError("binding_conflict");
    }
    return { conversationId: row.id, ownerId };
  }
  if (isNonEmptyString(row.sessionId)) {
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
