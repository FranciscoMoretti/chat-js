"use client";
import { definePlugin } from "@/lib/ui-slots";
import { ComposerAttachments } from "@/components/chat-slots";
import { attachmentUploads } from "./integration";
import { AttachFilesControl, TakePhotoControl } from "./controls";

export const attachmentUploadsClient = definePlugin({
  id: "attachment-uploads",
  contributions: [
    ComposerAttachments.contribute(AttachFilesControl),
    ComposerAttachments.contribute(TakePhotoControl),
  ],
  uploads: attachmentUploads,
});
