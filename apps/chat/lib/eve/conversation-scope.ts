import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  bindAcceptedEveConversation,
  readEveSessionMapping,
} from "@/lib/db/eve-queries";
/* oxlint-enable sort-imports */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { eveRequest } from "./server";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveSessionMappingError } from "./session-mapping-error";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve assertNativeReceipt's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable init-declarations, max-params, max-statements, no-magic-numbers -- * init-declarations (#507): assertNativeReceipt assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-params (#511): assertNativeReceipt keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): assertNativeReceipt keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): assertNativeReceipt uses 404, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (resolveEveConversationScope); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resolveEveConversationScope's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable init-declarations, max-params, max-statements, no-magic-numbers */

/* oxlint-disable max-params, max-statements, typescript/strict-boolean-expressions -- * max-params (#511): resolveEveConversationScope keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): resolveEveConversationScope keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/strict-boolean-expressions (#610): resolveEveConversationScope intentionally keeps the existing falsy-value behavior of ownerId; identity.data; row; row.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-params, max-statements, typescript/strict-boolean-expressions */
