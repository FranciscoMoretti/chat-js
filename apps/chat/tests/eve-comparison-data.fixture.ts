import { gatewayModelDefaults } from "../lib/ai/gateway-model-defaults";
import type { EveResponseGroupResult } from "../lib/eve/response-group-contracts";

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
