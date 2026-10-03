/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/ai/gateway-model-defaults"; "../lib/eve/response-group-contracts" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import { gatewayModelDefaults } from "../lib/ai/gateway-model-defaults";
import type { EveResponseGroupResult } from "../lib/eve/response-group-contracts";
/* oxlint-enable import/no-relative-parent-imports */

const ownerId = "comparison-fixture-owner";

const firstModel = gatewayModelDefaults.workflows.chat;

const secondModel =
  gatewayModelDefaults.curatedDefaults.find((model) => model !== firstModel) ??
  gatewayModelDefaults.workflows.title;

const groupId = "00000000-0000-4000-8000-000000000090";

const firstConversation = "00000000-0000-4000-8000-000000000091";

const secondConversation = "00000000-0000-4000-8000-000000000092";

const partialGroup: EveResponseGroupResult = {
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

/* oxlint-disable no-magic-numbers -- no-magic-numbers (#517): completeGroup uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases. */
const completeGroup: EveResponseGroupResult = {
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
/* oxlint-enable no-magic-numbers */
export {
  completeGroup,
  firstConversation,
  firstModel,
  groupId,
  ownerId,
  partialGroup,
  secondConversation,
  secondModel,
};
