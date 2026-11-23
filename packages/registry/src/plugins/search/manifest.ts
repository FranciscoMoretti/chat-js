import { definePluginItem } from "../define-item";

const searchFiles = [
  "chatjs/plugins/search/backfill.ts",
  "chatjs/plugins/search/chat.ts",
  "chatjs/plugins/search/chat-ui.ts",
  "chatjs/plugins/search/sidebar-item.tsx",
  "chatjs/plugins/search/router.ts",
  "chatjs/plugins/search/search-backfill.ts",
  "chatjs/plugins/search/search-chats.tsx",
  "chatjs/plugins/search/search-surface.tsx",
  "chatjs/plugins/search/search-surface-props.ts",
  "chatjs/plugins/search/search-hook.ts",
  "chatjs/plugins/search/search-queries.ts",
  "chatjs/plugins/search/search-results-view.tsx",
  "chatjs/plugins/search/search-schema.ts",
  "chatjs/plugins/search/search-text.ts",
  "chatjs/plugins/search/use-debounced-search.ts",
  "agent/hooks/search.ts",
];

const searchItem = definePluginItem(
  {
    dependencies: [
      "@tanstack/react-query",
      "@trpc/server",
      "drizzle-orm",
      "lucide-react",
    ],
    name: "search",
    registryDependencies: [
      "alert",
      "button",
      "command",
      "dialog",
      "empty",
      "sidebar",
      "skeleton",
    ],
    description: "Search chat titles and conversation text",
    files: searchFiles.map((file) => ({
      path: file.startsWith("chatjs/plugins/search/")
        ? `src/plugins/search/src/${file.slice("chatjs/plugins/search/".length)}`
        : `src/plugins/search/adapters/${file}`,
      target: `~/${file}`,
      type: "registry:file" as const,
    })),
  },
  {
    uiBase: "base",
    databaseSchemas: ["chatjs/plugins/search/search-schema.ts"],
  }
);
const searchDefinition = searchItem.meta.chatjs;
export { searchItem, searchFiles, searchDefinition };
