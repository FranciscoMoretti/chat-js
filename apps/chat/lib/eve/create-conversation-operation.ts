/* oxlint-disable import/max-dependencies --
 * import/max-dependencies (#524): import from "zod" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 */
import type { z } from "zod";

import { canSpend } from "@/lib/db/credits";
import { assertEveFilesOwned } from "@/lib/db/eve-files";
import { readEveGuestOwner } from "@/lib/db/eve-guests";
import { getEveCreation } from "@/lib/db/eve-queries";
import { createModuleLogger } from "@/lib/logger";

import type { createConversationInput } from "./contracts";
import { EveCreationRecoveryError } from "./creation-recovery-error";
import { executeEveConversationCreation } from "./execute-conversation-creation";
import { eveMessageFileKeys } from "./file-references";
import { loadEveModelDefinition } from "./model-selection";
import { prepareEveMessage } from "./prepare-message";
import { reconcileEveOwnerUsage } from "./reconcile-usage";
import { assertEveConfigured } from "./server";
import {
  EveUsageReconciliationBusyError,
  eveUsageBusyResponse,
} from "./usage-reconciliation-busy";
/* oxlint-enable import/max-dependencies */

const logger = createModuleLogger("eve/admission");

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * init-declarations (#507): createEveConversationOperation assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): createEveConversationOperation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): createEveConversationOperation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): createEveConversationOperation accepts input: z.infer<typeof createConversationInput>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): createEveConversationOperation intentionally keeps the existing falsy-value behavior of existing; await readEveGuestOwner(ownerId); distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const createEveConversationOperation = async (
  ownerId: string,
  input: z.infer<typeof createConversationInput>,
  guestReservationId?: string
): Promise<Response> => {
  try {
    assertEveConfigured();
  } catch {
    return Response.json(
      { error: "The agent worker is not configured." },
      { status: 503 }
    );
  }
  let preparedMessage:
    | Awaited<ReturnType<typeof prepareEveMessage>>
    | undefined;
  try {
    const existing = await getEveCreation(ownerId, input.operationId);
    if (existing?.creationKind === "copy") {
      return Response.json(
        {
          creationRejected: true,
          error:
            "This operation belongs to a saved copy. Resume the copy operation instead.",
        },
        { status: 409 }
      );
    }
    if (existing?.state === "deleting" || existing?.state === "deleted") {
      return Response.json(
        {
          code: "conversation_deleted",
          creationRejected: true,
          error: "This conversation has been deleted.",
        },
        { status: 404 }
      );
    }
    if (!existing) {
      try {
        await loadEveModelDefinition(input.modelId);
        await assertEveFilesOwned(ownerId, eveMessageFileKeys(input.message));
        preparedMessage = await prepareEveMessage(input.message, input.modelId);
      } catch {
        return Response.json(
          {
            creationRejected: true,
            error: "This model or attachment is not available for chat.",
          },
          { status: 400 }
        );
      }
      if (!(await readEveGuestOwner(ownerId))) {
        await reconcileEveOwnerUsage(ownerId);
        if (!(await canSpend(ownerId))) {
          return Response.json(
            { error: "Insufficient credits" },
            { status: 402 }
          );
        }
      }
    }
  } catch (error) {
    if (error instanceof EveUsageReconciliationBusyError) {
      return eveUsageBusyResponse(error);
    }
    logger.error(
      {
        errorType: error instanceof Error ? error.name : "unknown",
        operationId: input.operationId,
      },
      "Conversation admission failed"
    );
    if (error instanceof EveCreationRecoveryError) {
      return Response.json(
        { code: "creation_recovery_unavailable", error: error.message },
        { status: 503 }
      );
    }
    return Response.json(
      {
        error:
          "Usage reconciliation is unavailable. Try again before starting a new conversation.",
      },
      { status: 503 }
    );
  }
  return await executeEveConversationCreation(
    ownerId,
    input,
    guestReservationId,
    preparedMessage
  );
};
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
