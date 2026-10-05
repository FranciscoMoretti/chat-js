/* oxlint-disable import/max-dependencies --

 * import/max-dependencies (#524): import from "zod" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  CreationConflictError,
  CreationProjectNotFoundError,
  createEveConversation,
  getEveConversation,
  getEveCreation,
} from "@/lib/db/eve-queries";
/* oxlint-enable sort-imports */
import { createModuleLogger } from "@/lib/logger";

import { waitForEveCheckpoint } from "./checkpoint-readiness";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveForkInput, createConversationInput } from "./contracts";
/* oxlint-enable sort-imports */
import { eveConversationTitleFallback } from "./conversation-title";
import { eveCreationContentHash } from "./creation-content-hash";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  EveCreationTransportError,
  requestEveCreation,
} from "./creation-transport";
/* oxlint-enable sort-imports */
import { eveMessageFileKeys } from "./file-references";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveMessageDeliveryMetadata } from "./message-delivery";
/* oxlint-enable sort-imports */
import { eveMessageTitle } from "./message-input";
import { loadEveModelDefinition } from "./model-selection";
import { prepareEveMessage } from "./prepare-message";
/* oxlint-enable import/max-dependencies */

const logger = createModuleLogger("eve/creation");
const OPERATION_LOOKUP_TIMEOUT_MS = 15_000;
const SESSION_DISPATCH_TIMEOUT_MS = 30_000;
const MINIMUM_SESSION_IDENTIFIER_LENGTH = 1;
const HTTP_NOT_FOUND = 404;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resolveFork's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/explicit-function-return-type, typescript/strict-boolean-expressions --

 * typescript/explicit-function-return-type (#560): Keep resolveFork's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): resolveFork intentionally keeps the existing falsy-value behavior of source?.sessionId; input.beforeMessageId; input.checkpointId; distinguishing empty, zero, and absent states requires a domain behavior decision.
  */
const resolveFork = async (
  ownerId: string,
  input: EveForkInput | undefined
) => {
  if (!input) {
    return;
  }
  const source = await getEveConversation(ownerId, input.conversationId);
  if (!source?.sessionId || source.state !== "bound") {
    // oxlint-disable-next-line typescript/consistent-return -- #580: resolveFork has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return Response.json(
      { creationRejected: true, error: "Source conversation not found." },
      { status: 404 }
    );
  }
  if (input.beforeMessageId) {
    // oxlint-disable-next-line typescript/consistent-return -- #580: resolveFork has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return {
      beforeMessageId: input.beforeMessageId,
      sessionId: source.sessionId,
    };
  }
  // oxlint-disable-next-line typescript/consistent-return -- #580: resolveFork has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return {
    beforeTurnId: input.beforeTurnId,
    sessionId: source.sessionId,
    ...(input.checkpointId ? { checkpointId: input.checkpointId } : {}),
  };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type, typescript/strict-boolean-expressions */

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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve executeEveConversationCreation's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable init-declarations, max-lines-per-function, max-params, max-statements, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --

 * init-declarations (#507): executeEveConversationCreation assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): executeEveConversationCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): executeEveConversationCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): executeEveConversationCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-undefined (#519): executeEveConversationCreation uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): executeEveConversationCreation accepts input: z.infer<typeof createConversationInput>; initialPreparedMessage?: Awaited<ReturnType<typeof prepareEveMessage>>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): executeEveConversationCreation intentionally keeps the existing falsy-value behavior of await getEveCreation(ownerId, input.operationId); fork.beforeTurnId; distinguishing empty, zero, and absent states requires a domain behavior decision.
  */
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
  input: z.infer<typeof createConversationInput>,
  guestReservationId?: string,
  initialPreparedMessage?: Awaited<ReturnType<typeof prepareEveMessage>>
): Promise<Response> => {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable init-declarations, max-lines-per-function, max-params, max-statements, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
