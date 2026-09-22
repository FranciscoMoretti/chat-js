import { z } from "zod";

import {
  CreationConflictError,
  CreationProjectNotFoundError,
  createEveConversation,
  getEveConversation,
  getEveCreation,
} from "../db/eve-queries";
import { createModuleLogger } from "../logger";
import { waitForEveCheckpoint } from "./checkpoint-readiness";
import type { createConversationInput, EveForkInput } from "./contracts";
import { eveConversationTitleFallback } from "./conversation-title";
import { eveCreationContentHash } from "./creation-content-hash";
import {
  EveCreationTransportError,
  requestEveCreation,
} from "./creation-transport";
import { eveMessageFileKeys } from "./file-references";
import { eveMessageDeliveryMetadata } from "./message-delivery";
import { eveMessageTitle } from "./message-input";
import { loadEveModelDefinition } from "./model-selection";
import { prepareEveMessage } from "./prepare-message";

const logger = createModuleLogger("eve/creation");

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

/** Executes an admitted, journaled command. Retries retain the reservation and native operation identity. */
export const executeEveConversationCreation = async (
  ownerId: string,
  input: z.infer<typeof createConversationInput>,
  guestReservationId?: string,
  initialPreparedMessage?: Awaited<ReturnType<typeof prepareEveMessage>>
) => {
  let preparedMessage = initialPreparedMessage;
  try {
    let fork: Exclude<Awaited<ReturnType<typeof resolveFork>>, Response>;
    if (!(await getEveCreation(ownerId, input.operationId))) {
      const resolved = await resolveFork(ownerId, input.fork);
      if (resolved instanceof Response) {
        return resolved;
      }
      fork = resolved;
    }
    const binding = await createEveConversation(
      ownerId,
      input.operationId,
      eveMessageTitle(input.message),
      async (operationId) => {
        const existing = await requestEveCreation(
          "lookup",
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
          throw new EveCreationTransportError("lookup", existing.status);
        }
        // Accepted operations recover independently of their former source.
        if (input.fork && !fork) {
          const resolved = await resolveFork(ownerId, input.fork);
          if (resolved instanceof Response) {
            throw new CreationConflictError("Source conversation not found.");
          }
          fork = resolved;
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
        const result = await requestEveCreation(
          "dispatch",
          ownerId,
          "/eve/v1/session",
          {
            body: JSON.stringify({
              fork,
              message: preparedMessage,
              messageMetadata: eveMessageDeliveryMetadata(
                input.operationId,
                input.selectedTool
              ),
              operationId,
            }),
            method: "POST",
            signal: AbortSignal.timeout(30_000),
          },
          input.modelId,
          input.selectedTool
        );
        if (!result.ok) {
          throw new EveCreationTransportError("dispatch", result.status);
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
        initialRequest: input,
        initialTitle: eveConversationTitleFallback(input.message),
      }
    );
    return Response.json(binding);
  } catch (error) {
    logger.error(
      {
        errorType: error instanceof Error ? error.name : "unknown",
        operationId: input.operationId,
        ...(error instanceof EveCreationTransportError
          ? { stage: error.stage, status: error.status }
          : {}),
      },
      "Conversation creation remains unresolved"
    );
    return creationFailure(error);
  }
};
