import { installedUploads } from "@/chatjs/generated/installed-uploads";
import type { AttachmentUploadIntegration } from "@/chatjs/core/installation/contracts";
import { selectIntegration } from "@/chatjs/core/installation/select";

export const attachmentUploads: AttachmentUploadIntegration = selectIntegration(
  "attachment uploads",
  installedUploads
) ?? {
  useUploads: () => ({
    enabled: false,
    busy: false,
    uploadQueue: [],
    errors: [],
    enqueue: async () => {
      await Promise.reject(new Error("Attachment uploads are not installed."));
    },
  }),
};
