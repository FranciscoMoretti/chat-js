import registryPackage from "../../../package.json";

import { definePluginItem } from "../define-item";

// Canonical upload implementation; apps/chat contains installed demo copies.
const attachmentUploadFiles = [
  "chatjs/plugins/attachment-uploads/controls.tsx",
  "chatjs/plugins/attachment-uploads/uploads.ts",
  "chatjs/plugins/attachment-uploads/upload.ts",
  "chatjs/plugins/attachment-uploads/upload-prep.ts",
  "app/(chat)/api/files/upload/route.ts",
  "chatjs/plugins/attachment-uploads/routes/upload.ts",
  "chatjs/plugins/attachment-uploads/chat-ui.ts",
];

const attachmentUploadsItem = definePluginItem(
  {
    dependencies: [
      "lucide-react",
      "sonner",
      `browser-image-compression@${registryPackage.devDependencies["browser-image-compression"]}`,
    ],
    description:
      "User attachment picker, camera, paste/drop, preprocessing and upload endpoint",
    files: attachmentUploadFiles.map((file) => ({
      path: file.startsWith("chatjs/plugins/attachment-uploads/")
        ? `src/plugins/attachment-uploads/src/${file.slice("chatjs/plugins/attachment-uploads/".length)}`
        : `src/plugins/attachment-uploads/adapters/${file}`,
      target: `~/${file}`,
      type: "registry:file",
    })),
    name: "attachment-uploads",
  },
  {
    uiBase: "base",
    requiresStorage: true,
  }
);
export { attachmentUploadFiles, attachmentUploadsItem };
