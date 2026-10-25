import type { ChatClientPlugin } from "@/lib/plugin-contracts";
import { EveSearchChats } from "./search-chats";

export const searchClient = () =>
  ({
    id: "search",
    chat: { SidebarHeader: EveSearchChats },
  }) satisfies ChatClientPlugin;
