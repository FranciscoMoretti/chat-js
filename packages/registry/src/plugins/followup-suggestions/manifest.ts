import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const followupSuggestionsFiles = [
  "plugins/followup-suggestions/chat.ts",
  "plugins/followup-suggestions/client-plugin.ts",
  "plugins/followup-suggestions/followup-completion.ts",
  "plugins/followup-suggestions/followup-context.ts",
  "plugins/followup-suggestions/followup-hook.ts",
  "plugins/followup-suggestions/followup-queries.ts",
  "plugins/followup-suggestions/followup-schema.ts",
  "plugins/followup-suggestions/followup-suggestions-view.tsx",
  "plugins/followup-suggestions/generate-suggestions.ts",
  "plugins/followup-suggestions/router.ts",
  "plugins/followup-suggestions/server-plugin.ts",
  "plugins/followup-suggestions/suggestion-output.ts",
  "plugins/followup-suggestions/suggestions.tsx",
  "plugins/followup-suggestions/use-followups.ts",
  "agent/hooks/followup-suggestions.ts",
];
const followupSuggestionsDefinition = pluginDefinitionSchema.parse({
  contractVersion: 2,
  uiBase: "base",
  id: "followup-suggestions",
  kind: "plugin",
  files: followupSuggestionsFiles,
  databaseSchemas: ["plugins/followup-suggestions/followup-schema.ts"],
  server: {
    export: "followupSuggestions",
    routers: ["followupSuggestions"],
  },
  chat: { export: "followupChat" },
  client: { export: "followupSuggestionsClient", chat: true },
});
const followupSuggestionsItem: RegistryItem = {
  dependencies: ["@tanstack/react-query", "drizzle-orm", "lucide-react"],
  name: "followup-suggestions",
  type: "registry:item",
  description: "Durable follow-up suggestions for completed answers",
  files: followupSuggestionsFiles.map((file) => ({
    path: file.startsWith("plugins/followup-suggestions/")
      ? `src/plugins/followup-suggestions/src/${file.slice("plugins/followup-suggestions/".length)}`
      : `src/plugins/followup-suggestions/adapters/${file}`,
    target: `~/${file}`,
    type: "registry:file" as const,
  })),
  meta: { chatjs: followupSuggestionsDefinition },
};
export {
  followupSuggestionsItem,
  followupSuggestionsFiles,
  followupSuggestionsDefinition,
};
