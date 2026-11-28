import { installedChat } from "@/chatjs/generated/installed-chat";
import { composeChat } from "@/chatjs/core/chat/compose";

// App-owned: add local integrations or wrap installed integrations here. Sync preserves this file.
export const chat = composeChat(installedChat);
