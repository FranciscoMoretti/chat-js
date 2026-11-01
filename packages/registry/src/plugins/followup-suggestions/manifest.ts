import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const followupSuggestionsFiles = [
  "chatjs/plugins/followup-suggestions/chat.ts",
  "chatjs/plugins/followup-suggestions/client-plugin.ts",
  "chatjs/plugins/followup-suggestions/followup-completion.ts",
  "chatjs/plugins/followup-suggestions/followup-context.ts",
  "chatjs/plugins/followup-suggestions/followup-hook.ts",
  "chatjs/plugins/followup-suggestions/followup-queries.ts",
  "chatjs/plugins/followup-suggestions/followup-schema.ts",
  "chatjs/plugins/followup-suggestions/followup-suggestions-view.tsx",
  "chatjs/plugins/followup-suggestions/generate-suggestions.ts",
  "chatjs/plugins/followup-suggestions/router.ts",
  "chatjs/plugins/followup-suggestions/server-plugin.ts",
  "chatjs/plugins/followup-suggestions/suggestion-output.ts",
  "chatjs/plugins/followup-suggestions/suggestions.tsx",
  "chatjs/plugins/followup-suggestions/use-followups.ts",
  "agent/hooks/followup-suggestions.ts",
];
const followupSuggestionsDefinition = pluginDefinitionSchema.parse({
  contractVersion: 2,
  uiBase: "base",
  id: "followup-suggestions",
  kind: "plugin",
  files: followupSuggestionsFiles,
  databaseSchemas: ["chatjs/plugins/followup-suggestions/followup-schema.ts"],
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
    path: file.startsWith("chatjs/plugins/followup-suggestions/")
      ? `src/plugins/followup-suggestions/src/${file.slice("chatjs/plugins/followup-suggestions/".length)}`
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
