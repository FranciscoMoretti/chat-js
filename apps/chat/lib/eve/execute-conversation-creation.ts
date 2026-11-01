import { CreationRejectedError } from "@/lib/creation-rejected-error";
import { reconcileEveWorkspaceTurn } from "./reconcile-workspace-turn";
import { EveWorkspaceBusyError } from "../db/eve-workspace-turns";
import { EveForkBoundaryError } from "./fork-boundary-error";
import {
  dispatchEveOnce,
  EveDispatchUnknownError,
} from "@/lib/db/eve-dispatch";

import {
  CreationConflictError,
  createEveConversation,
  getEveCreation,
} from "@/lib/db/eve-queries";
import {
  EveCreationTransportError,
  requestEveCreation,
} from "./creation-transport";
import type { createConversationInput } from "./contracts";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { UserContent } from "ai";
import { createModuleLogger } from "@/lib/logger";
import { eveConversationTitleFallback } from "./conversation-title";
import { eveCreationContentHash } from "./creation-content-hash";
import { eveMessageFileKeys } from "./file-references";
import { eveMessageTitle } from "./message-input";
import { loadEveModelDefinition } from "./model-selection";
import { prepareEveMessage } from "./prepare-message";
import { z } from "zod";

type PreparedContentPart<Part> = {
  readonly [Field in keyof Part]: Field extends "type" ? Part[Field] : unknown;
};

const logger = createModuleLogger("eve/creation");
const SESSION_DISPATCH_TIMEOUT_MS = 30_000;
const MINIMUM_SESSION_IDENTIFIER_LENGTH = 1;
const creationFailure = (cause: unknown): Response => {
  if (cause instanceof EveWorkspaceBusyError) {
    return Response.json(
      { code: "workspace_busy", error: cause.message },
      { status: 409 }
    );
  }
  if (cause instanceof EveForkBoundaryError) {
    return Response.json(
      { creationRejected: true, error: cause.message },
      { status: 400 }
    );
  }
  if (cause instanceof CreationRejectedError) {
    return Response.json(
      {
        code: cause.code,
        creationRejected: true,
        error: cause.message,
      },
      { status: cause.status }
    );
  }
  return Response.json(
    {
      ...(cause instanceof CreationConflictError ? { code: cause.code } : {}),
      error:
        cause instanceof CreationConflictError
          ? cause.message
          : "Creation is unresolved. Retain this operation for reconciliation before retrying.",
    },
    { status: 409 }
  );
};

/**
 * Executes an admitted creation command while retaining its journaled operation identity.
 * @param {string} ownerId Owner used to resolve source conversations and reserve the creation.
 * @param {z.infer<typeof createConversationInput>} input Immutable original creation request retained when dispatch is unresolved.
 * @param {Awaited<ReturnType<typeof prepareEveMessage>> | undefined} initialPreparedMessage Optional prepared message reused without preparing it again.
 * @returns {Promise<Response>} The bound conversation, or an error response that leaves unresolved creation recoverable.
 */
export const executeEveConversationCreation = async (
  ownerId: string,
  input: ReadonlyNativeSurface<z.infer<typeof createConversationInput>>,
  initialPreparedMessage?:
    | string
    | readonly PreparedContentPart<UserContent[number]>[]
): Promise<Response> => {
  let preparedMessage = initialPreparedMessage;
  try {
    const existing = await getEveCreation(ownerId, input.operationId);
    if (
      (existing?.state !== "bound" || input.fork) &&
      preparedMessage === undefined
    ) {
      await loadEveModelDefinition(input.modelId);
      preparedMessage = await prepareEveMessage(input.message, input.modelId);
    }
    const binding = await createEveConversation(
      ownerId,
      input.operationId,
      eveMessageTitle(input.message),
      async (operationId) => {
        const result = await requestEveCreation(
          "dispatch",
          ownerId,
          "/eve/chat/v1/session",
          {
            body: JSON.stringify({
              ...(input.fork ? { seed: true } : { message: preparedMessage }),
              operationId,
            }),
            method: "POST",
            signal: AbortSignal.timeout(SESSION_DISPATCH_TIMEOUT_MS),
          },
          input.modelId,
          input.selectedTool
        );
        if (!result.ok) {
          throw new EveCreationTransportError("dispatch", result.status);
        }
        return z
          .object({
            sessionId: z.string().min(MINIMUM_SESSION_IDENTIFIER_LENGTH),
          })
          .parse(await result.json()).sessionId;
      },
      {
        fileKeys: eveMessageFileKeys(input.message),
        fork: input.fork,
        forkKind: input.forkKind,
        initialContentHash: eveCreationContentHash(
          input.message,
          input.selectedTool
        ),
        initialModelId: input.modelId,
        initialRequest: input,
        initialTitle: eveConversationTitleFallback(input.message),
      }
    );
    if (input.fork) {
      await reconcileEveWorkspaceTurn(ownerId, binding.id, {
        waitForSeed: true,
      });
      await dispatchEveOnce(
        {
          ownerId,
          operationId: input.operationId,
          conversationId: binding.id,
          kind: "send",
          intent: {
            sessionId: binding.sessionId,
            message: input.message,
            modelId: input.modelId ?? null,
            selectedTool: input.selectedTool ?? null,
          },
        },
        async () => {
          const result = await requestEveCreation(
            "dispatch",
            ownerId,
            `/eve/chat/v1/session/${binding.sessionId}`,
            {
              body: JSON.stringify({ message: preparedMessage }),
              method: "POST",
              signal: AbortSignal.timeout(SESSION_DISPATCH_TIMEOUT_MS),
            },
            input.modelId,
            input.selectedTool
          );
          if (!result.ok) {
            throw new EveDispatchUnknownError();
          }
          return z
            .object({
              sessionId: z.literal(binding.sessionId),
              deliveryId: z.string().min(1),
            })
            .parse(await result.json());
        }
      );
    }
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
