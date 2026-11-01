import type { z } from "zod";

import { canStartPaidTurn } from "@/lib/eve/spending-admission";
import { assertEveFilesOwned } from "@/lib/db/eve-files";
import { getEveCreation } from "@/lib/db/eve-queries";
import { createModuleLogger } from "@/lib/logger";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import type { createConversationInput } from "./contracts";
import { EveCreationRecoveryError } from "./creation-recovery-error";
import { executeEveConversationCreation } from "./execute-conversation-creation";
import { eveMessageFileKeys } from "./file-references";
import { loadEveModelDefinition } from "./model-selection";
import { prepareEveMessage } from "./prepare-message";
import { assertEveConfigured } from "./server";
import {
  EveUsageReconciliationBusyError,
  eveUsageBusyResponse,
} from "./usage-reconciliation-busy";

const logger = createModuleLogger("eve/admission");

export const createEveConversationOperation = async (
  ownerId: string,
  input: ReadonlyNativeSurface<z.infer<typeof createConversationInput>>
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
    if (!(existing !== undefined)) {
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
      if (!(await canStartPaidTurn(ownerId))) {
        return Response.json(
          { error: "Insufficient credits" },
          { status: 402 }
        );
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
  return await executeEveConversationCreation(ownerId, input, preparedMessage);
};
