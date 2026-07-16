import type { PendingChatConfirmation } from "@/lib/stores/with-chat-persistence";

interface UserMessagePersistenceAcknowledgment {
  chatId: string;
  parallelGroupId: string | null;
  userMessageId: string;
}

interface ProvisionalChatConfirmationEntry {
  acknowledgment: UserMessagePersistenceAcknowledgment | null;
  confirmation: PendingChatConfirmation;
}

const pendingConfirmations = new Map<
  string,
  ProvisionalChatConfirmationEntry
>();

export function registerProvisionalChatConfirmation(
  chatId: string,
  confirmation: PendingChatConfirmation
) {
  pendingConfirmations.set(chatId, {
    acknowledgment: null,
    confirmation,
  });
}

export function acknowledgeProvisionalUserMessagePersistence(
  acknowledgment: UserMessagePersistenceAcknowledgment
) {
  const entry = pendingConfirmations.get(acknowledgment.chatId);
  if (!entry) {
    return false;
  }

  const expectedParallelGroupId =
    entry.confirmation.message.metadata.parallelGroupId ?? null;
  if (
    entry.confirmation.message.id !== acknowledgment.userMessageId ||
    expectedParallelGroupId !== acknowledgment.parallelGroupId
  ) {
    return false;
  }

  entry.acknowledgment = acknowledgment;
  return true;
}

export function claimConfirmedProvisionalChat(chatId: string) {
  const entry = pendingConfirmations.get(chatId) ?? null;
  if (entry?.acknowledgment) {
    pendingConfirmations.delete(chatId);
    return entry.confirmation;
  }
  return null;
}

export function clearProvisionalChatConfirmations() {
  pendingConfirmations.clear();
}
