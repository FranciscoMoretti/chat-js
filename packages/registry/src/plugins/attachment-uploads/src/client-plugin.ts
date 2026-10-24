import type { ChatClientPlugin } from "@/lib/plugin-contracts";
import { attachmentUploads } from "./integration";

export const attachmentUploadsClient = () =>
  ({
    id: "attachment-uploads",
    composerControls: attachmentUploads.controls,
    uploads: attachmentUploads,
  }) satisfies ChatClientPlugin;
