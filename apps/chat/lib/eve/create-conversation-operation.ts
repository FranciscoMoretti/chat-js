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

const logger = createModuleLogger("eve/admission");

export const createEveConversationOperation = async (
  ownerId: string,
  input: z.infer<typeof createConversationInput>,
  guestReservationId?: string
) => {
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
  return executeEveConversationCreation(
    ownerId,
    input,
    guestReservationId,
    preparedMessage
  );
};
