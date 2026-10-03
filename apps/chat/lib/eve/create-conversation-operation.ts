/* oxlint-disable import/max-dependencies, import/no-relative-parent-imports, sort-imports --
 * import/max-dependencies (#524): import from "zod" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/credits"; "../db/eve-files"; "../db/eve-guests"; "../db/eve-queries"; "../logger" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { z } from "zod";

import { canSpend } from "../db/credits";
import { assertEveFilesOwned } from "../db/eve-files";
import { readEveGuestOwner } from "../db/eve-guests";
import { getEveCreation } from "../db/eve-queries";
import { createModuleLogger } from "../logger";
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
/* oxlint-enable import/max-dependencies, import/no-relative-parent-imports, sort-imports */

const logger = createModuleLogger("eve/admission");

/* oxlint-disable import/no-named-export, import/prefer-default-export, init-declarations, max-lines-per-function, max-statements, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/no-named-export (#527): Preserve the named createEveConversationOperation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): createEveConversationOperation remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * init-declarations (#507): createEveConversationOperation assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): createEveConversationOperation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): createEveConversationOperation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-ternary (#518): createEveConversationOperation derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): createEveConversationOperation sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): createEveConversationOperation handles optional existing?.creationKind; existing?.state without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, init-declarations, max-lines-per-function, max-statements, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
