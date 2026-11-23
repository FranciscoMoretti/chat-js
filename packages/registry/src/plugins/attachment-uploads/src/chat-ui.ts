"use client";
import { definePlugin, slot } from "@/chatjs/core/ui/slots";
import { ComposerAttachments } from "@/components/chat-slots";
import { AttachFilesControl, TakePhotoControl } from "./controls";

export const chatUi = definePlugin({
  id: "attachment-uploads",
  slots: [
    slot(ComposerAttachments, AttachFilesControl),
    slot(ComposerAttachments, TakePhotoControl),
  ],
});
