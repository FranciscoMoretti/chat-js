/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/ai/gateway-model-defaults"; "../lib/eve/response-group-contracts" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import { gatewayModelDefaults } from "../lib/ai/gateway-model-defaults";
import type { EveResponseGroupResult } from "../lib/eve/response-group-contracts";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): ownerId stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ownerId API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const ownerId = "comparison-fixture-owner";
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): firstModel stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named firstModel API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const firstModel = gatewayModelDefaults.workflows.chat;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): secondModel stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named secondModel API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const secondModel =
  gatewayModelDefaults.curatedDefaults.find((model) => model !== firstModel) ??
  gatewayModelDefaults.workflows.title;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): groupId stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named groupId API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const groupId = "00000000-0000-4000-8000-000000000090";
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): firstConversation stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named firstConversation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const firstConversation = "00000000-0000-4000-8000-000000000091";
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): secondConversation stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named secondConversation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const secondConversation = "00000000-0000-4000-8000-000000000092";
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): partialGroup stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named partialGroup API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const partialGroup: EveResponseGroupResult = {
  candidates: [
    {
      operationId: "00000000-0000-4000-8000-000000000093",
      modelId: firstModel,
      state: "bound",
      conversationId: firstConversation,
      sessionId: "first-native",
    },
    {
      operationId: "00000000-0000-4000-8000-000000000094",
      modelId: secondModel,
      state: "unresolved",
    },
  ],
  id: groupId,
};
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, no-magic-numbers  --
 * import/group-exports (#523): completeGroup stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named completeGroup API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): completeGroup uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-rest-spread-properties (#543): completeGroup copies or separates ...partialGroup while preserving existing object ownership; mutating source objects is not equivalent.
 */
export const completeGroup: EveResponseGroupResult = {
  ...partialGroup,
  candidates: [
    partialGroup.candidates[0],
    {
      conversationId: secondConversation,
      modelId: secondModel,
      operationId: partialGroup.candidates[1].operationId,
      sessionId: "second-native",
      state: "bound",
    },
  ],
};
/* oxlint-enable import/group-exports, no-magic-numbers */
