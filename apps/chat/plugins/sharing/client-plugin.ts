"use client";
import { definePlugin, slot } from "@/lib/ui-slots";
import { ChatActions, ChatHeaderActions } from "@/components/chat-slots";
import { SharingActions, SharingHeaderActions } from "./ui/chat-contributions";

export const sharingClient = definePlugin({
  id: "sharing",
  slots: [
    slot(ChatActions, SharingActions),
    slot(ChatHeaderActions, SharingHeaderActions),
  ],
});
