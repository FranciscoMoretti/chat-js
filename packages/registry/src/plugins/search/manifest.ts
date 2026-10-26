import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const searchFiles = [
  "plugins/search/backfill.ts",
  "plugins/search/chat.ts",
  "plugins/search/client-plugin.ts",
  "plugins/search/router.ts",
  "plugins/search/search-backfill.ts",
  "plugins/search/search-chats.tsx",
  "plugins/search/search-hook.ts",
  "plugins/search/search-queries.ts",
  "plugins/search/search-results-view.tsx",
  "plugins/search/search-schema.ts",
  "plugins/search/search-text.ts",
  "plugins/search/server-plugin.ts",
  "plugins/search/use-debounced-search.ts",
  "agent/hooks/search.ts",
];
const searchDefinition = pluginDefinitionSchema.parse({
  contractVersion: 2,
  uiBase: "base",
  id: "search",
  kind: "plugin",
  files: searchFiles,
  databaseSchemas: ["plugins/search/search-schema.ts"],
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
  description: "Search chat titles and conversation text",
  files: searchFiles.map((file) => ({
    path: file.startsWith("plugins/search/")
      ? `src/plugins/search/src/${file.slice("plugins/search/".length)}`
      : `src/plugins/search/adapters/${file}`,
    target: `~/${file}`,
    type: "registry:file" as const,
  })),
  meta: { chatjs: searchDefinition },
};
export { searchItem, searchFiles, searchDefinition };
