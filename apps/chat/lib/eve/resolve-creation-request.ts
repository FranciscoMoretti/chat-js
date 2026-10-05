import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  CheckpointRejectedError,
  checkpointRejectionReason,
} from "./checkpoint-rejection";
/* oxlint-enable sort-imports */
import {
  CreationRejectedError,
  requestConversation,
} from "./create-conversation";
import {
  requestResponseGroup,
  retainResponseGroupDraft,
} from "./create-response-group";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { finishCreation, readCreationRequest } from "./pending-create";
/* oxlint-enable sort-imports */
import type { CreationScope } from "./pending-create";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (resolveCreationRequest); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resolveCreationRequest's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --

 * jsdoc/require-param (#534): resolveCreationRequest's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): resolveCreationRequest's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): resolveCreationRequest keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): resolveCreationRequest keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): resolveCreationRequest keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): resolveCreationRequest uses 35_000, 409 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): resolveCreationRequest uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep resolveCreationRequest's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep resolveCreationRequest's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): resolveCreationRequest accepts operation: NonNullable<ReturnType<typeof readCreationRequest>>; scope?: CreationScope; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): resolveCreationRequest intentionally keeps the existing falsy-value behavior of operation.fork?.checkpointId; distinguishing empty, zero, and absent states requires a domain behavior decision.
  */
/** Resolve one saved operation; ambiguous outcomes never release its draft. */
export const resolveCreationRequest = async (
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  ownerId: string,
  operation: NonNullable<ReturnType<typeof readCreationRequest>>,
  scope?: CreationScope
) => {
  if ("modelIds" in operation) {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading checkpointId from operation.fork; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    if (operation.fork?.checkpointId) {
      const { conversationId, checkpointId, beforeTurnId } = operation.fork;
      const response = await fetch(
        `/api/agent-conversations/${conversationId}/checkpoint`,
        {
          body: JSON.stringify({ beforeTurnId, checkpointId }),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal: AbortSignal.timeout(35_000),
        }
      );
      if (!response.ok) {
        const rejection = z
          .object({
            beforeTurnId: z.literal(beforeTurnId),
            checkpointId: z.literal(checkpointId),
            checkpointRejected: z.literal(true),
            conversationId: z.literal(conversationId),
            reason: checkpointRejectionReason,
          })
          .safeParse(
            await response.json().catch((): void => {
              // The checkpoint-rejection schema rejects an absent JSON body.
            })
          );
        if (response.status === 409 && rejection.success) {
          throw new CreationRejectedError(
            new CheckpointRejectedError(rejection.data.reason).message
          );
        }
        throw new Error(
          "The comparison's saved conversation state is unconfirmed. Retry the saved request."
        );
      }
      z.object({
        beforeTurnId: z.literal(beforeTurnId),
        checkpointId: z.literal(checkpointId),
        conversationId: z.literal(conversationId),
        ready: z.literal(true),
      }).parse(await response.json());
    }
    const result = await requestResponseGroup(operation);
    const bound = result.candidates.find(
      (candidate) => candidate.state === "bound"
    );
    if (!bound) {
      throw new Error(
        "Comparison creation is unconfirmed. Retry this saved request."
      );
    }
    retainResponseGroupDraft(storage, ownerId, operation, result, scope);
    return {
      group: result,
      id: bound.conversationId,
      sessionId: bound.sessionId,
    };
  }
  const binding = await requestConversation(operation);
  if (
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading operationId from readCreationRequest(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    readCreationRequest(storage, ownerId, scope)?.operationId ===
    operation.operationId
  ) {
    finishCreation(storage, ownerId, scope);
  }
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing binding own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  return { ...binding, group: undefined };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
