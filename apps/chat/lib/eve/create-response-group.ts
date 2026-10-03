import type { z } from "zod";

import { CreationRejectedError } from "./create-conversation";
import { finishCreation, readCreationRequest } from "./pending-create";
import type { CreationScope } from "./pending-create";
import { eveResponseGroupResult } from "./response-group-contracts";
import { eveResponseGroupInput } from "./response-group-input";

const recoveryKey = (ownerId: string, groupId: string): string =>
  `chatjs.eve.comparison:${ownerId}:${groupId}`;

type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/* oxlint-disable import/group-exports, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions  --
 * import/group-exports (#523): readResponseGroupDraft stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named readResponseGroupDraft API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-ternary (#518): readResponseGroupDraft derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): readResponseGroupDraft uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep readResponseGroupDraft's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep readResponseGroupDraft's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): readResponseGroupDraft intentionally keeps the existing falsy-value behavior of saved; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const readResponseGroupDraft = (
  storage: StorageAccess,
  ownerId: string,
  groupId: string
) => {
  const saved = storage.getItem(recoveryKey(ownerId, groupId));
  return saved ? eveResponseGroupInput.parse(JSON.parse(saved)) : undefined;
};
/* oxlint-enable import/group-exports, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, jsdoc/require-param, max-params, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): retainResponseGroupDraft stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named retainResponseGroupDraft API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): retainResponseGroupDraft's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-params (#511): retainResponseGroupDraft keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-optional-chaining (#542): retainResponseGroupDraft handles optional readCreationRequest(storage, ownerId, scope)?.operationId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): retainResponseGroupDraft accepts operation: z.infer<typeof eveResponseGroupInput>; result: z.infer<typeof eveResponseGroupResult>; scope?: CreationScope; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Move recovery to its bound group before allowing a new request in this composer. */
export const retainResponseGroupDraft = (
  storage: StorageAccess,
  ownerId: string,
  operation: z.infer<typeof eveResponseGroupInput>,
  result: z.infer<typeof eveResponseGroupResult>,
  scope?: CreationScope
): void => {
  const unresolved = result.candidates.some(
    (candidate) => candidate.state !== "bound"
  );
  if (unresolved) {
    storage.setItem(recoveryKey(ownerId, result.id), JSON.stringify(operation));
  } else {
    storage.removeItem(recoveryKey(ownerId, result.id));
  }
  if (
    readCreationRequest(storage, ownerId, scope)?.operationId ===
    operation.operationId
  ) {
    finishCreation(storage, ownerId, scope);
  }
};
/* oxlint-enable import/group-exports, jsdoc/require-param, max-params, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): requestResponseGroup stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named requestResponseGroup API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): requestResponseGroup uses 75_000, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): requestResponseGroup sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): requestResponseGroup handles optional primary?.state without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/explicit-function-return-type (#560): Keep requestResponseGroup's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep requestResponseGroup's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): requestResponseGroup accepts operation: z.infer<typeof eveResponseGroupInput>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const requestResponseGroup = async (
  operation: z.infer<typeof eveResponseGroupInput>
) => {
  const response = await fetch("/api/agent-response-groups", {
    body: JSON.stringify(operation),
    headers: { "content-type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(75_000),
  });
  if (!response.ok) {
    throw new Error(
      "Comparison creation is unconfirmed. Retry the saved request."
    );
  }
  const result = eveResponseGroupResult.parse(await response.json());
  const [primary] = result.candidates;
  if (
    primary?.state === "rejected" &&
    (result.candidates
      .slice(1)
      .every((candidate) => candidate.state === "waiting") ||
      result.candidates.every((candidate) => candidate.state === "rejected"))
  ) {
    throw new CreationRejectedError(
      primary.error,
      primary.code === "project_not_found"
    );
  }
  return result;
};
/* oxlint-enable import/group-exports, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
