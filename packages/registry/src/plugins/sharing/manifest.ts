import { definePluginItem } from "../define-item";

const sharingFiles = [
  "chatjs/plugins/sharing/chat.ts",
  "chatjs/plugins/sharing/chat-ui.ts",
  "chatjs/plugins/sharing/public-conversation.ts",
  "chatjs/plugins/sharing/queries.ts",
  "chatjs/plugins/sharing/router.ts",
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

const sharingItem = definePluginItem(
  {
    name: "sharing",
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
  },
  {
    uiBase: "base",
  }
);
const sharingDefinition = sharingItem.meta.chatjs;
export { sharingItem, sharingFiles, sharingDefinition };
