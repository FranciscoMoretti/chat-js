/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import type { EveResponseGroupResult } from "../lib/eve/response-group-contracts";

export const ownerId = "comparison-fixture-owner";
export const firstModel = "google/gemini-2.5-flash-lite";
export const secondModel = "google/gemini-2.5-flash";
export const groupId = "00000000-0000-4000-8000-000000000090";
export const firstConversation = "00000000-0000-4000-8000-000000000091";
export const secondConversation = "00000000-0000-4000-8000-000000000092";
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
