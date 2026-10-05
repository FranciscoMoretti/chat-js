import type { EveMessage } from "eve/client";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveForkInput, EveForkKind } from "./contracts";
/* oxlint-enable sort-imports */

const importedBoundary = /^seed_message_(?<messageIndex>0|[1-9][0-9]{0,3})$/u;
const nativeBoundary = /^turn_(?<turnIndex>0|[1-9][0-9]*)$/u;

/* oxlint-disable no-undefined, typescript/strict-boolean-expressions --
 no-undefined (#519): eveUserForkBoundary uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/strict-boolean-expressions (#610): eveUserForkBoundary intentionally keeps the existing falsy-value behavior of message.metadata?.turnId; distinguishing empty, zero, and absent states requires a domain behavior decision.  */
const eveUserForkBoundary = (
  message: Pick<EveMessage, "id" | "role" | "metadata">
): string | undefined => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading optimistic from message.metadata; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (message.role !== "user" || message.metadata?.optimistic) {
    return;
  }
  if (
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading turnId from message.metadata; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    message.metadata?.turnId &&
    nativeBoundary.test(message.metadata.turnId)
  ) {
    // oxlint-disable-next-line typescript/consistent-return -- #580: eveUserForkBoundary has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return message.metadata.turnId;
  }
  // oxlint-disable-next-line typescript/consistent-return -- #580: eveUserForkBoundary has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return importedBoundary.test(message.id) ? message.id : undefined;
};
/* oxlint-enable no-undefined, typescript/strict-boolean-expressions */

interface EveBranchReference {
  forkKind?: EveForkKind | null;
  forkMessageId?: string | null;
  forkTurnId: string | null;
  id: string;
  parentConversationId: string | null;
  responseGroupId?: string | null;
  responseGroupIndex?: number | null;
}

/* oxlint-disable max-statements, no-magic-numbers, typescript/strict-boolean-expressions --
max-statements (#512): resolveForkSource keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): resolveForkSource uses 5 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/strict-boolean-expressions (#610): resolveForkSource intentionally keeps the existing falsy-value behavior of current.parentConversationId; current.forkTurnId; distinguishing empty, zero, and absent states requires a domain behavior decision.  */
/** Resolve native checkpoint ancestry while keeping imported seed boundaries local.
 * @param {string} conversationId Conversation version from which the edit or fork starts.
 * @param {string} boundaryId Imported message or native turn checkpoint immediately before the fork.
 * @param {readonly Readonly<EveBranchReference>[]} branches Known ancestry used to find the conversation owning the native checkpoint.
 * @returns {EveForkInput} The source conversation and its local message or native turn boundary.
 */
const resolveForkSource = (
  conversationId: string,
  boundaryId: string,
  branches: readonly Readonly<EveBranchReference>[]
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (eveUserForkBoundary, resolveForkSource); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable max-statements, no-magic-numbers, typescript/strict-boolean-expressions */
export { eveUserForkBoundary, resolveForkSource };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (EveBranchReference); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { EveBranchReference };
/* oxlint-enable import/no-named-export */
