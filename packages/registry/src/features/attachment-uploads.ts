import type { RegistryItem } from "shadcn/schema";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { featureDefinitionSchema } from "../../metadata";
/* oxlint-enable import/no-relative-parent-imports */

// Canonical upload implementation; apps/chat contains installed demo copies.
const attachmentUploadFiles = [
  "features/attachment-uploads/controls.tsx",
  "features/attachment-uploads/integration.tsx",
  "features/attachment-uploads/upload.ts",
  "features/attachment-uploads/upload-prep.ts",
  "app/(chat)/api/files/upload/route.ts",
];

const attachmentUploadsItem: RegistryItem = {
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
      requiresStorage: true,
    }),
  },
  name: "attachment-uploads",
  type: "registry:item",
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (attachmentUploadFiles, attachmentUploadsItem); the enabled import/no-default-export convention rejects the default-export alternative. */
export { attachmentUploadFiles, attachmentUploadsItem };
/* oxlint-enable import/no-named-export */
