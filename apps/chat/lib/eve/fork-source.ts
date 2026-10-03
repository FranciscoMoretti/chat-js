import type { EveMessage } from "eve/client";

import type { EveForkInput, EveForkKind } from "./contracts";

const importedBoundary = /^seed_message_(?<messageIndex>0|[1-9][0-9]{0,3})$/u;
const nativeBoundary = /^turn_(?<turnIndex>0|[1-9][0-9]*)$/u;

/* oxlint-disable import/group-exports, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions  --
 * import/group-exports (#523): eveUserForkBoundary stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveUserForkBoundary API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-ternary (#518): eveUserForkBoundary derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): eveUserForkBoundary uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-optional-chaining (#542): eveUserForkBoundary handles optional message.metadata?.optimistic; message.metadata?.turnId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/explicit-function-return-type (#560): Keep eveUserForkBoundary's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep eveUserForkBoundary's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): eveUserForkBoundary intentionally keeps the existing falsy-value behavior of message.metadata?.turnId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const eveUserForkBoundary = (
  message: Pick<EveMessage, "id" | "role" | "metadata">
) => {
  if (message.role !== "user" || message.metadata?.optimistic) {
    return;
  }
  if (
    message.metadata?.turnId &&
    nativeBoundary.test(message.metadata.turnId)
  ) {
    // oxlint-disable-next-line typescript/consistent-return -- #580: eveUserForkBoundary has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return message.metadata.turnId;
  }
  // oxlint-disable-next-line typescript/consistent-return -- #580: eveUserForkBoundary has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return importedBoundary.test(message.id) ? message.id : undefined;
};
/* oxlint-enable import/group-exports, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */

export interface EveBranchReference {
  forkKind?: EveForkKind | null;
  forkMessageId?: string | null;
  forkTurnId: string | null;
  id: string;
  parentConversationId: string | null;
  responseGroupId?: string | null;
  responseGroupIndex?: number | null;
}

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * import/group-exports (#523): resolveForkSource stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named resolveForkSource API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): resolveForkSource's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): resolveForkSource's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): resolveForkSource keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): resolveForkSource uses 5 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): resolveForkSource accepts branches: readonly EveBranchReference[]; branch; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): resolveForkSource intentionally keeps the existing falsy-value behavior of current.parentConversationId; current.forkTurnId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Resolve native checkpoint ancestry while keeping imported seed boundaries local. */
export const resolveForkSource = (
  conversationId: string,
  boundaryId: string,
  branches: readonly EveBranchReference[]
): EveForkInput => {
  if (
    importedBoundary.test(boundaryId) &&
    branches.some((branch) => branch.id === conversationId)
  ) {
    // Each descendant owns its retained seed prefix and document checkpoints.
    return { beforeMessageId: boundaryId, conversationId };
  }
  if (!nativeBoundary.test(boundaryId)) {
    throw new Error(
      "The source version is unavailable. Reload before editing."
    );
  }
  const beforeTurnId = boundaryId;
  const visited = new Set<string>();
  let current = branches.find((branch) => branch.id === conversationId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (
      !(current.parentConversationId && current.forkTurnId) ||
      BigInt(beforeTurnId.slice(5)) >= BigInt(current.forkTurnId.slice(5))
    ) {
      return { beforeTurnId, conversationId: current.id };
    }
    const parentId = current.parentConversationId;
    current = branches.find((branch) => branch.id === parentId);
  }
  throw new Error("The source version is unavailable. Reload before editing.");
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
