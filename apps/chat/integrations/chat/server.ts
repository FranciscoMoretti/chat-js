import { installedChat } from "@/chatjs/generated/installed-chat";
import { composeChat } from "@/chatjs/core/chat/compose";

// App-owned: add local adapters or wrap installed adapters here. Sync preserves this file.
export const chat = composeChat(installedChat);
