import registryPackage from "../../../package.json";
import type { RegistryItem } from "shadcn/schema";

import { pluginDefinitionSchema } from "../../../metadata";

// Canonical upload implementation; apps/chat contains installed demo copies.
const attachmentUploadFiles = [
  "plugins/attachment-uploads/controls.tsx",
  "plugins/attachment-uploads/integration.tsx",
  "plugins/attachment-uploads/upload.ts",
  "plugins/attachment-uploads/upload-prep.ts",
  "app/(chat)/api/files/upload/route.ts",
  "plugins/attachment-uploads/routes/upload.ts",
  "plugins/attachment-uploads/client-plugin.ts",
];

const attachmentUploadsItem: RegistryItem = {
  dependencies: [
    "lucide-react",
    "sonner",
    `browser-image-compression@${registryPackage.devDependencies["browser-image-compression"]}`,
    `react-dropzone@${registryPackage.devDependencies["react-dropzone"]}`,
  ],
  description:
    "User attachment picker, camera, paste/drop, preprocessing and upload endpoint",
  files: attachmentUploadFiles.map((file) => ({
    path: file.startsWith("plugins/attachment-uploads/")
      ? `src/plugins/attachment-uploads/src/${file.slice("plugins/attachment-uploads/".length)}`
      : `src/plugins/attachment-uploads/adapters/${file}`,
    target: `~/${file}`,
    type: "registry:file",
  })),
  meta: {
    chatjs: pluginDefinitionSchema.parse({
      contractVersion: 1,
      id: "attachment-uploads",
      kind: "plugin",
      files: attachmentUploadFiles,
      client: {
        export: "attachmentUploadsClient",
        composerControls: ["attach-files", "take-photo"],
        uploads: true,
      },
      requiresStorage: true,
    }),
  },
  name: "attachment-uploads",
  type: "registry:item",
};
export { attachmentUploadFiles, attachmentUploadsItem };
