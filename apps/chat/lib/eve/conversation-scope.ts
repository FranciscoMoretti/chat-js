import { isNonEmptyString } from "@/lib/is-non-empty-string";

import { z } from "zod";

import {
  bindAcceptedEveCreation,
  readEveSessionMapping,
} from "@/lib/db/eve-queries";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { EveSessionMappingError } from "./session-mapping-error";

/**
 * Auth attributes locate a reservation; only trusted native delivery evidence authorizes early binding.
 * @param {string | undefined} ownerId - Authenticated owner; absence raises an authentication error.
 * @param {string} sessionId - Native session identity that must match the durable binding or receipt.
 * @param {ReadonlyNativeSurface<AbortSignal>} abortSignal - Cancellation checked before lookup.
 * @param {unknown | undefined} reservationId - Optional creation UUID from auth attributes, validated before lookup.
 * @param {string | undefined} deliveryId - Positive evidence from the authored initial turn hook.
 * @returns {Promise<{ branchId: string; ownerId: string }>} Durable conversation identity and the authenticated owner after receipt reconciliation.
 */
export const resolveEveConversationScope = async (
  ownerId: string | undefined,
  sessionId: string,
  abortSignal: ReadonlyNativeSurface<AbortSignal>,
  reservationId?: unknown,
  deliveryId?: string
): Promise<{ branchId: string; ownerId: string }> => {
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
  if (row === null) {
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
    return { branchId: row.id, ownerId };
  }
  if (isNonEmptyString(row.sessionId)) {
    throw new EveSessionMappingError("binding_conflict");
  }
  // Seed acceptance has its own resource/copy journal and must finish there.
  if (row.creationKind === "copy") {
    throw new EveSessionMappingError("identity_pending");
  }
  if (!isNonEmptyString(identity.data) || !isNonEmptyString(deliveryId)) {
    throw new EveSessionMappingError("identity_pending");
  }
  abortSignal.throwIfAborted();
  await bindAcceptedEveCreation(ownerId, row.id, sessionId, deliveryId);
  return { branchId: row.id, ownerId };
};
