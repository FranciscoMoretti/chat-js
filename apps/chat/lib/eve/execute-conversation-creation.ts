import { isNonEmptyString } from "@/lib/is-non-empty-string";

import {
  CreationConflictError,
  CreationProjectNotFoundError,
  createEveConversation,
  getEveConversation,
  getEveCreation,
} from "@/lib/db/eve-queries";
import {
  EveCreationTransportError,
  requestEveCreation,
} from "./creation-transport";
import type { EveForkInput, createConversationInput } from "./contracts";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { UserContent } from "ai";
import { createModuleLogger } from "@/lib/logger";
import { eveConversationTitleFallback } from "./conversation-title";
import { eveCreationContentHash } from "./creation-content-hash";
import { eveMessageDeliveryMetadata } from "./message-delivery";
import { eveMessageFileKeys } from "./file-references";
import { eveMessageTitle } from "./message-input";
import { loadEveModelDefinition } from "./model-selection";
import { prepareEveMessage } from "./prepare-message";
import { waitForEveCheckpoint } from "./checkpoint-readiness";
import { z } from "zod";

type PreparedContentPart<Part> = {
  readonly [Field in keyof Part]: Field extends "type" ? Part[Field] : unknown;
};

const logger = createModuleLogger("eve/creation");
const OPERATION_LOOKUP_TIMEOUT_MS = 15_000;
const SESSION_DISPATCH_TIMEOUT_MS = 30_000;
const MINIMUM_SESSION_IDENTIFIER_LENGTH = 1;
const HTTP_NOT_FOUND = 404;

const resolveFork = async (
  ownerId: string,
  input: EveForkInput | undefined
): Promise<
  | Response
  | { beforeMessageId: string; sessionId: string }
  | {
      checkpointId?: string;
      beforeTurnId: string | undefined;
      sessionId: string;
      beforeMessageId?: undefined;
    }
  | undefined
> => {
  if (!input) {
    return undefined;
  }
  const source = await getEveConversation(ownerId, input.conversationId);
  if (
    !source ||
    typeof source.sessionId !== "string" ||
    source.sessionId === "" ||
    source.state !== "bound"
  ) {
    return Response.json(
      { creationRejected: true, error: "Source conversation not found." },
      { status: HTTP_NOT_FOUND }
    );
  }

  if (isNonEmptyString(input.beforeMessageId)) {
    return {
      beforeMessageId: input.beforeMessageId,
      sessionId: source.sessionId,
    };
  }
  return {
    beforeTurnId: input.beforeTurnId,
    sessionId: source.sessionId,

    ...(isNonEmptyString(input.checkpointId)
      ? { checkpointId: input.checkpointId }
      : {}),
  };
};

const creationFailure = (cause: unknown): Response => {
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
 * @param {z.infer<typeof createConversationInput>} input Original creation request reused when an uncertain dispatch is retried.
 * @param {string | undefined} guestReservationId Optional admission reservation attached to the created conversation.
 * @param {Awaited<ReturnType<typeof prepareEveMessage>> | undefined} initialPreparedMessage Optional prepared message reused without preparing it again.
 * @returns {Promise<Response>} The bound conversation, or an error response that leaves unresolved creation recoverable.
 */
export const executeEveConversationCreation = async (
  ownerId: string,
  input: ReadonlyNativeSurface<z.infer<typeof createConversationInput>>,
  guestReservationId?: string,
  initialPreparedMessage?:
    | string
    | readonly PreparedContentPart<UserContent[number]>[]
): Promise<Response> => {
  let preparedMessage = initialPreparedMessage;
  try {
    let fork: Exclude<Awaited<ReturnType<typeof resolveFork>>, Response>;

    if (!((await getEveCreation(ownerId, input.operationId)) !== undefined)) {
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
          `/eve/chat/v1/operation/${operationId}`,
          {
            signal: AbortSignal.timeout(OPERATION_LOOKUP_TIMEOUT_MS),
          }
        );
        if (existing.ok) {
          return z
            .object({
              sessionId: z.string().min(MINIMUM_SESSION_IDENTIFIER_LENGTH),
            })
            .parse(await existing.json()).sessionId;
        }
        const lookupFailure = z
          .object({ code: z.literal("eve_operation_not_found") })
          .safeParse(
            await existing.json().catch((): void => {
              // The missing-operation schema rejects an absent JSON body.
            })
          );
        if (existing.status !== HTTP_NOT_FOUND || !lookupFailure.success) {
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
        if (
          fork &&
          "beforeTurnId" in fork &&
          typeof fork.beforeTurnId === "string" &&
          fork.beforeTurnId !== ""
        ) {
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
          "/eve/chat/v1/session",
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
