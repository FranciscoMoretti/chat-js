/* oxlint-disable import/no-relative-parent-imports --

 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-queries" dependency within this package instead of introducing an alias or barrel API.
  */
import { z } from "zod";

import {
  bindAcceptedEveConversation,
  readEveSessionMapping,
} from "../db/eve-queries";
import { eveRequest } from "./server";
import { EveSessionMappingError } from "./session-mapping-error";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable init-declarations, max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types --

 * init-declarations (#507): assertNativeReceipt assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-params (#511): assertNativeReceipt keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): assertNativeReceipt keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): assertNativeReceipt uses 404, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): assertNativeReceipt accepts abortSignal: AbortSignal; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
  */
const assertNativeReceipt = async (
  ownerId: string,
  reservationId: string,
  sessionId: string,
  abortSignal: AbortSignal
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
/* oxlint-enable init-declarations, max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-params, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --

 * jsdoc/require-param (#534): resolveEveConversationScope's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): resolveEveConversationScope's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-params (#511): resolveEveConversationScope keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): resolveEveConversationScope keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep resolveEveConversationScope's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep resolveEveConversationScope's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): resolveEveConversationScope accepts abortSignal: AbortSignal; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): resolveEveConversationScope intentionally keeps the existing falsy-value behavior of ownerId; identity.data; row; row.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
  */
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-params, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
