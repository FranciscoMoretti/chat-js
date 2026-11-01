import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const searchFiles = [
  "chatjs/plugins/search/backfill.ts",
  "chatjs/plugins/search/chat.ts",
  "chatjs/plugins/search/client-plugin.ts",
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
  "chatjs/plugins/search/server-plugin.ts",
  "chatjs/plugins/search/use-debounced-search.ts",
  "agent/hooks/search.ts",
];
const searchDefinition = pluginDefinitionSchema.parse({
  contractVersion: 2,
  uiBase: "base",
  id: "search",
  kind: "plugin",
  files: searchFiles,
  databaseSchemas: ["chatjs/plugins/search/search-schema.ts"],
  server: { export: "search", routers: ["search"] },
  chat: { export: "searchChat" },
  client: { export: "searchClient", chat: true },
});
const searchItem: RegistryItem = {
  dependencies: [
    "@tanstack/react-query",
    "@trpc/server",
    "drizzle-orm",
    "lucide-react",
  ],
  name: "search",
  type: "registry:item",
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
  meta: { chatjs: searchDefinition },
};
export { searchItem, searchFiles, searchDefinition };
