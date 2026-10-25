import type { ChatClientPlugin } from "@/lib/plugin-contracts";
import { SharingActions, SharingHeaderActions } from "./ui/chat-contributions";

export const sharingClient = () =>
  ({
    id: "sharing",
    chat: { Actions: SharingActions, HeaderActions: SharingHeaderActions },
  }) satisfies ChatClientPlugin;
