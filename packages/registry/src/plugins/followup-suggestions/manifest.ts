import { definePluginItem } from "../define-item";

const followupSuggestionsFiles = [
  "chatjs/plugins/followup-suggestions/chat.ts",
  "chatjs/plugins/followup-suggestions/chat-ui.ts",
  "chatjs/plugins/followup-suggestions/followup-completion.ts",
  "chatjs/plugins/followup-suggestions/followup-context.ts",
  "chatjs/plugins/followup-suggestions/followup-hook.ts",
  "chatjs/plugins/followup-suggestions/followup-queries.ts",
  "chatjs/plugins/followup-suggestions/followup-schema.ts",
  "chatjs/plugins/followup-suggestions/followup-suggestions-view.tsx",
  "chatjs/plugins/followup-suggestions/generate-suggestions.ts",
  "chatjs/plugins/followup-suggestions/router.ts",
  "chatjs/plugins/followup-suggestions/suggestion-output.ts",
  "chatjs/plugins/followup-suggestions/suggestions.tsx",
  "chatjs/plugins/followup-suggestions/use-followups.ts",
  "agent/hooks/followup-suggestions.ts",
];

const followupSuggestionsItem = definePluginItem(
  {
    dependencies: ["@tanstack/react-query", "drizzle-orm", "lucide-react"],
    name: "followup-suggestions",
    description: "Durable follow-up suggestions for completed answers",
    files: followupSuggestionsFiles.map((file) => ({
      path: file.startsWith("chatjs/plugins/followup-suggestions/")
        ? `src/plugins/followup-suggestions/src/${file.slice("chatjs/plugins/followup-suggestions/".length)}`
        : `src/plugins/followup-suggestions/adapters/${file}`,
      target: `~/${file}`,
      type: "registry:file" as const,
    })),
  },
  {
    uiBase: "base",
    databaseSchemas: ["chatjs/plugins/followup-suggestions/followup-schema.ts"],
  }
);
const followupSuggestionsDefinition = followupSuggestionsItem.meta.chatjs;
export {
  followupSuggestionsItem,
  followupSuggestionsFiles,
  followupSuggestionsDefinition,
};
