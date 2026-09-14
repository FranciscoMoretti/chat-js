import { z } from "zod";

import { canSpend } from "@/lib/db/credits";
import { assertEveFilesOwned } from "@/lib/db/eve-files";
import { readEveGuestOwner } from "@/lib/db/eve-guests";
import {
  CreationConflictError,
  CreationProjectNotFoundError,
  createEveConversation,
  getEveConversation,
  getEveCreation,
} from "@/lib/db/eve-queries";
import type {
  createConversationInput,
  EveForkInput,
} from "@/lib/eve/contracts";
import { eveConversationTitleFallback } from "@/lib/eve/conversation-title";
import { eveMessageFileKeys } from "@/lib/eve/file-references";
import { eveMessageTitle } from "@/lib/eve/message-input";
import { loadEveModelDefinition } from "@/lib/eve/model-selection";
import { prepareEveMessage } from "@/lib/eve/prepare-message";
import { reconcileEveOwnerUsage } from "@/lib/eve/reconcile-usage";
import { assertEveConfigured, eveRequest } from "@/lib/eve/server";

import { waitForEveCheckpoint } from "./checkpoint-readiness";
import { eveCreationContentHash } from "./creation-content-hash";
import { eveToolMetadata } from "./message-tool-selection";

const resolveFork = async (
  ownerId: string,
  input: EveForkInput | undefined
) => {
  if (!input) {
    return;
  }
  const source = await getEveConversation(ownerId, input.conversationId);
  if (!source?.sessionId || source.state !== "bound") {
    return Response.json(
      { creationRejected: true, error: "Source conversation not found." },
      { status: 404 }
    );
  }
  if (input.beforeMessageId) {
    return {
      beforeMessageId: input.beforeMessageId,
      sessionId: source.sessionId,
    };
  }
  return {
    beforeTurnId: input.beforeTurnId,
    sessionId: source.sessionId,
    ...(input.checkpointId ? { checkpointId: input.checkpointId } : {}),
  };
};

const creationFailure = (cause: unknown) => {
  if (cause instanceof CreationProjectNotFoundError) {
    return Response.json(
      {
        code: "project_not_found",
        creationRejected: true,
        error: cause.message,
      },
      { status: 404 }
    );
  }
  return Response.json(
    {
      error:
        cause instanceof CreationConflictError
          ? cause.message
          : "Creation is unresolved. Retain this operation for reconciliation before retrying.",
    },
    { status: 409 }
  );
};

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
  const fork = await resolveFork(ownerId, input.fork);
  if (fork instanceof Response) {
    return fork;
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
  } catch {
    return Response.json(
      {
        error:
          "Usage reconciliation is unavailable. Try again before starting a new conversation.",
      },
      { status: 503 }
    );
  }
  try {
    const binding = await createEveConversation(
      ownerId,
      input.operationId,
      eveMessageTitle(input.message),
      async (operationId) => {
        const existing = await eveRequest(
          ownerId,
          `/eve/v1/operation/${operationId}`,
          {
            signal: AbortSignal.timeout(15_000),
          }
        );
        if (existing.ok) {
          return z
            .object({ sessionId: z.string().min(1) })
            .parse(await existing.json()).sessionId;
        }
        const lookupFailure = z
          .object({ code: z.literal("eve_operation_not_found") })
          .safeParse(await existing.json().catch(() => null));
        if (existing.status !== 404 || !lookupFailure.success) {
          throw new Error("Native operation lookup is unavailable.");
        }
        if (fork && "beforeTurnId" in fork && fork.beforeTurnId) {
          await waitForEveCheckpoint(
            ownerId,
            fork.sessionId,
            fork.beforeTurnId,
            fork.checkpointId
          );
        }
        // Uncertain reservations may have reached Eve before their reply was lost.
        // Reuse the same operation with the original input; never dispatch an empty turn.
        if (preparedMessage === undefined) {
          await loadEveModelDefinition(input.modelId);
          preparedMessage = await prepareEveMessage(
            input.message,
            input.modelId
          );
        }
        const result = await eveRequest(
          ownerId,
          "/eve/v1/session",
          {
            body: JSON.stringify({
              fork,
              message: preparedMessage,
              messageMetadata: eveToolMetadata(input.selectedTool),
              operationId,
            }),
            method: "POST",
            signal: AbortSignal.timeout(30_000),
          },
          input.modelId,
          input.selectedTool
        );
        if (!result.ok) {
          throw new Error("Session creation failed.");
        }
        return z
          .object({ sessionId: z.string().min(1) })
          .parse(await result.json()).sessionId;
      },
      {
        fileKeys: eveMessageFileKeys(input.message),
        fork: input.fork,
        forkKind: input.forkKind,
        guestReservationId,
        initialContentHash: eveCreationContentHash(
          input.message,
          input.selectedTool
        ),
        initialModelId: input.modelId,
        initialProjectId: input.projectId,
        initialTitle: eveConversationTitleFallback(input.message),
      }
    );
    return Response.json(binding);
  } catch (error) {
    return creationFailure(error);
  }
};
