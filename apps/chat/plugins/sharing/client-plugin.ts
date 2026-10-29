"use client";
import { definePlugin } from "@/lib/ui-slots";
import { ChatActions, ChatHeaderActions } from "@/components/chat-slots";
import { SharingActions, SharingHeaderActions } from "./ui/chat-contributions";

export const sharingClient = definePlugin({
  id: "sharing",
  contributions: [
    ChatActions.contribute(SharingActions),
    ChatHeaderActions.contribute(SharingHeaderActions),
  ],
});
