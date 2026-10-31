import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const sharingFiles = [
  "plugins/sharing/chat.ts",
  "plugins/sharing/client-plugin.ts",
  "plugins/sharing/public-conversation.ts",
  "plugins/sharing/queries.ts",
  "plugins/sharing/router.ts",
  "plugins/sharing/server-plugin.ts",
  "plugins/sharing/ui/chat-contributions.tsx",
  "plugins/sharing/ui/share-button.tsx",
  "plugins/sharing/ui/share-dialog.tsx",
  "plugins/sharing/ui/share-menu-item.tsx",
  "plugins/sharing/ui/share-menu-surface.tsx",
  "plugins/sharing/ui/shared-badge.tsx",
  "plugins/sharing/ui/transcript-messages.tsx",
  "plugins/sharing/ui/shared-page.tsx",
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
    path: file.startsWith("plugins/sharing/")
      ? `src/plugins/sharing/src/${file.slice("plugins/sharing/".length)}`
      : `src/plugins/sharing/adapters/${file}`,
    target: `~/${file}`,
    type: "registry:file" as const,
  })),
  meta: { chatjs: sharingDefinition },
};
export { sharingItem, sharingFiles, sharingDefinition };
