"use client";
import { definePlugin, slot } from "@/chatjs/core/ui/slots";
import { ComposerAttachments } from "@/components/chat-slots";
import { attachmentUploads } from "./integration";
import { AttachFilesControl, TakePhotoControl } from "./controls";

export const attachmentUploadsClient = definePlugin({
  id: "attachment-uploads",
  slots: [
    slot(ComposerAttachments, AttachFilesControl),
    slot(ComposerAttachments, TakePhotoControl),
  ],
  uploads: attachmentUploads,
});
