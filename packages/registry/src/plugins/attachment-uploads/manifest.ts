import registryPackage from "../../../package.json";
import type { RegistryItem } from "shadcn/schema";

import { pluginDefinitionSchema } from "../../../metadata";

// Canonical upload implementation; apps/chat contains installed demo copies.
const attachmentUploadFiles = [
  "chatjs/plugins/attachment-uploads/controls.tsx",
  "chatjs/plugins/attachment-uploads/integration.tsx",
  "chatjs/plugins/attachment-uploads/upload.ts",
  "chatjs/plugins/attachment-uploads/upload-prep.ts",
  "app/(chat)/api/files/upload/route.ts",
  "chatjs/plugins/attachment-uploads/routes/upload.ts",
  "chatjs/plugins/attachment-uploads/client-plugin.ts",
];

const attachmentUploadsItem: RegistryItem = {
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
  meta: {
    chatjs: pluginDefinitionSchema.parse({
      contractVersion: 2,
      uiBase: "base",
      id: "attachment-uploads",
      kind: "plugin",
      files: attachmentUploadFiles,
      client: {
        export: "attachmentUploadsClient",
        composerControls: ["attach-files", "take-photo"],
        uploads: true,
      },
      requiresStorage: true,
      requiresPersistentSandbox: true,
    }),
  },
  name: "attachment-uploads",
  type: "registry:item",
};
export { attachmentUploadFiles, attachmentUploadsItem };
