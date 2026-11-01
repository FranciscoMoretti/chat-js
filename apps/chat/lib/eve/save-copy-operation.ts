import { createEveConversation, getEveCreation } from "@/lib/db/eve-queries";
import type { EveCopyInput } from "./copy-input";
import { assertEveConfigured } from "./server";
import { createNativeEveCopy } from "./create-native-copy";
import { loadEveModelDefinition } from "./model-selection";

/** A saved fork is an idle native history branch in the source owner's workspace. */
export const saveEveCopyOperation = async (
  ownerId: string,
  input: EveCopyInput
): Promise<{ id: string; sessionId: string }> => {
  assertEveConfigured();
  await loadEveModelDefinition(input.modelId);
  const existing = await getEveCreation(ownerId, input.operationId);
  return await createEveConversation(
    ownerId,
    input.operationId,
    existing?.firstMessage ?? "Conversation fork",
    async (reservationId) =>
      await createNativeEveCopy(ownerId, reservationId, input.modelId),
    {
      seedOnly: true,
      initialModelId: input.modelId,
      initialRequest: input,
      fork: { conversationId: input.sourceConversationId },
    }
  );
};
