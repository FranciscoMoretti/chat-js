export const MAIN_CHAT_THREAD_ID = "main";

export type ChatRuntimeId = `chat:${string}:thread:${string}`;

export interface ParsedChatRuntimeId {
  chatId: string;
  threadId: string;
}

const encodeRuntimeIdPart = (value: string) => encodeURIComponent(value);

const decodeRuntimeIdPart = (value: string) => decodeURIComponent(value);

export const createChatThreadRuntimeId = ({
  chatId,
  threadId,
}: {
  chatId: string;
  threadId: string;
}): ChatRuntimeId =>
  `chat:${encodeRuntimeIdPart(chatId)}:thread:${encodeRuntimeIdPart(threadId)}`;

export const createMainChatRuntimeId = (chatId: string): ChatRuntimeId =>
  createChatThreadRuntimeId({
    chatId,
    threadId: MAIN_CHAT_THREAD_ID,
  });

export const parseChatRuntimeId = (
  runtimeId: string | null | undefined
): ParsedChatRuntimeId | null => {
  if (!runtimeId) {
    return null;
  }

  const parts = runtimeId.split(":");
  if (parts.length !== 4 || parts[0] !== "chat" || parts[2] !== "thread") {
    return null;
  }

  try {
    const chatId = decodeRuntimeIdPart(parts[1] ?? "");
    const threadId = decodeRuntimeIdPart(parts[3] ?? "");

    if (!(chatId && threadId)) {
      return null;
    }

    return {
      chatId,
      threadId,
    };
  } catch {
    return null;
  }
};
