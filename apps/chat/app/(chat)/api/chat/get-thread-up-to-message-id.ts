import { getAllMessagesByChatId } from "@/lib/db/queries";
import { buildThreadFromLeaf } from "@/lib/thread-utils";

export const getThreadUpToMessageId = async (
  chatId: string,
  messageId: string | null
) => {
  if (!messageId) {
    return [];
  }

  const messages = await getAllMessagesByChatId({ chatId });

  return buildThreadFromLeaf(messages, messageId);
};
