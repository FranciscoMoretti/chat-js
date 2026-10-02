import type { RegistryItem } from "shadcn/schema";

import { featureDefinitionSchema } from "../../metadata";

// Canonical upload implementation; apps/chat contains installed demo copies.
export const attachmentUploadFiles = [
  "features/attachment-uploads/controls.tsx",
  "features/attachment-uploads/integration.tsx",
  "features/attachment-uploads/upload.ts",
  "features/attachment-uploads/upload-prep.ts",
  "app/(chat)/api/files/upload/route.ts",
];
export const attachmentUploadsItem: RegistryItem = {
  dependencies: ["browser-image-compression", "react-dropzone"],
  description:
    "User attachment picker, camera, paste/drop, preprocessing and upload endpoint",
  files: attachmentUploadFiles.map((file) => ({
    path: `src/features/attachment-uploads/${file}`,
    target: `~/${file}`,
    type: "registry:file",
  })),
  meta: {
    chatjs: featureDefinitionSchema.parse({
      contractVersion: 1,
      id: "attachment-uploads",
      kind: "feature",
    }),
  },
  name: "attachment-uploads",
  type: "registry:item",
};
