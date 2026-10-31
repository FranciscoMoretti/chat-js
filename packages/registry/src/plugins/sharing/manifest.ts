import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const sharingFiles = [
  "chatjs/plugins/sharing/chat.ts",
  "chatjs/plugins/sharing/client-plugin.ts",
  "chatjs/plugins/sharing/public-conversation.ts",
  "chatjs/plugins/sharing/queries.ts",
  "chatjs/plugins/sharing/router.ts",
  "chatjs/plugins/sharing/server-plugin.ts",
  "chatjs/plugins/sharing/ui/chat-contributions.tsx",
  "chatjs/plugins/sharing/ui/share-button.tsx",
  "chatjs/plugins/sharing/ui/share-dialog.tsx",
  "chatjs/plugins/sharing/ui/share-menu-item.tsx",
  "chatjs/plugins/sharing/ui/share-menu-surface.tsx",
  "chatjs/plugins/sharing/ui/shared-badge.tsx",
  "chatjs/plugins/sharing/ui/transcript-messages.tsx",
  "chatjs/plugins/sharing/ui/shared-page.tsx",
  "app/(chat)/share/[id]/page.tsx",
];
const sharingDefinition = pluginDefinitionSchema.parse({
  contractVersion: 2,
  uiBase: "base",
  id: "sharing",
  kind: "plugin",
  files: sharingFiles,
  server: { export: "sharing", routers: ["sharing"] },
  chat: { export: "sharingChat" },
  client: { export: "sharingClient", chat: true },
});
const sharingItem: RegistryItem = {
  name: "sharing",
  type: "registry:item",
  registryDependencies: [
    "breadcrumb",
    "button",
    "dialog",
    "dropdown-menu",
    "message-scroller",
    "popover",
    "tooltip",
  ],
  dependencies: [
    "@tanstack/react-query",
    "@trpc/server",
    "drizzle-orm",
    "lucide-react",
    "sonner",
  ],
  description: "Share read-only conversations with revocable public access",
  files: sharingFiles.map((file) => ({
    path: file.startsWith("chatjs/plugins/sharing/")
      ? `src/plugins/sharing/src/${file.slice("chatjs/plugins/sharing/".length)}`
      : `src/plugins/sharing/adapters/${file}`,
    target: `~/${file}`,
    type: "registry:file" as const,
  })),
  meta: { chatjs: sharingDefinition },
};
export { sharingItem, sharingFiles, sharingDefinition };
