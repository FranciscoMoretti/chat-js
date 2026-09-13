interface UserMessagePersistenceAcknowledgment {
  chatId: string;
  parallelGroupId: string | null;
  userMessageId: string;
}

interface ProvisionalChatConfirmation {
  acknowledged: boolean;
  parallelGroupId: string | null;
  userMessageId: string;
}

const pendingConfirmations = new Map<string, ProvisionalChatConfirmation>();

export const registerProvisionalChatConfirmation = (
  chatId: string,
  confirmation: Omit<ProvisionalChatConfirmation, "acknowledged">
) => {
  pendingConfirmations.set(chatId, {
    ...confirmation,
    acknowledged: false,
  });
};

export const acknowledgeProvisionalUserMessagePersistence = (
  acknowledgment: UserMessagePersistenceAcknowledgment
) => {
  const entry = pendingConfirmations.get(acknowledgment.chatId);
  if (
    !entry ||
    entry.userMessageId !== acknowledgment.userMessageId ||
    entry.parallelGroupId !== acknowledgment.parallelGroupId
  ) {
    return false;
  }

  entry.acknowledged = true;
  return true;
};

export const claimConfirmedProvisionalChat = (chatId: string) => {
  const entry = pendingConfirmations.get(chatId);
  if (!entry?.acknowledged) {
    return false;
  }
  pendingConfirmations.delete(chatId);
  return true;
};

export const discardUnacknowledgedProvisionalChatConfirmation = (
  chatId: string,
  userMessageId: string
) => {
  const entry = pendingConfirmations.get(chatId);
  if (!entry || entry.acknowledged || entry.userMessageId !== userMessageId) {
    return false;
  }

  pendingConfirmations.delete(chatId);
  return true;
};

export const clearProvisionalChatConfirmations = () => {
  pendingConfirmations.clear();
};
