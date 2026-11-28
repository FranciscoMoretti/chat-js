import { createConversationInput } from "./contracts";
import { requestConversation } from "./create-conversation";
import type { CreationHandler } from "./creation-contract";

export const creationHandler: CreationHandler = {
  parse(input) {
    const result = createConversationInput.safeParse(input);
    if (!result.success) {
      throw new Error(
        "This installation cannot read the saved request. Restore the original plugins and retry in this tab.",
        { cause: result.error }
      );
    }
    return result.data;
  },
  prepare(input, modelIds, saved) {
    if (modelIds.length > 1) {
      throw new Error("Choose one model for this installation.");
    }
    if (saved) {
      return createConversationInput.parse(saved);
    }
    const parsed = createConversationInput.safeParse({
      ...input,
      modelId: modelIds[0],
    });
    if (!parsed.success) {
      throw new Error("Enter a message between 1 and 16,000 characters.");
    }
    return parsed.data;
  },
  async resolve(_storage, _ownerId, operation) {
    return await requestConversation(createConversationInput.parse(operation));
  },
};
