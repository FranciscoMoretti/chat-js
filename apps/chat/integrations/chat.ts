import { installedChat } from "@/composition/generated/installed-chat";
import { composeChat } from "@/lib/compose-chat";

// App-owned: add local adapters or wrap installed adapters here. Sync preserves this file.
export const chat = composeChat(installedChat);
