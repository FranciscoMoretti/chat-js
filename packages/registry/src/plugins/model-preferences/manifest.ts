import { definePluginItem } from "../define-item";

const modelPreferencesFiles = [
  "chatjs/plugins/model-preferences/apply-model-preferences.ts",
  "chatjs/plugins/model-preferences/chat-ui.ts",
  "chatjs/plugins/model-preferences/settings-link.tsx",
  "chatjs/plugins/model-preferences/model-preferences-queries.ts",
  "chatjs/plugins/model-preferences/model-preferences-schema.ts",
  "chatjs/plugins/model-preferences/model-row.tsx",
  "chatjs/plugins/model-preferences/models-page.tsx",
  "chatjs/plugins/model-preferences/models-settings.tsx",
  "chatjs/plugins/model-preferences/models-table.tsx",
  "chatjs/plugins/model-preferences/router.ts",
  "chatjs/plugins/model-preferences/model-visibility.ts",
  "app/(chat)/settings/models/page.tsx",
];

const modelPreferencesItem = definePluginItem(
  {
    name: "model-preferences",
    dependencies: [
      "@tanstack/react-query",
      "drizzle-orm",
      "lucide-react",
      "sonner",
    ],
    description: "Per-user model visibility and model settings",
    files: modelPreferencesFiles.map((file) => ({
      path: file.startsWith("chatjs/plugins/model-preferences/")
        ? `src/plugins/model-preferences/src/${file.slice("chatjs/plugins/model-preferences/".length)}`
        : `src/plugins/model-preferences/adapters/${file}`,
      target: `~/${file}`,
      type: "registry:file" as const,
    })),
  },
  {
    uiBase: "base",
    databaseSchemas: [
      "chatjs/plugins/model-preferences/model-preferences-schema.ts",
    ],
  }
);
const modelPreferencesDefinition = modelPreferencesItem.meta.chatjs;
export {
  modelPreferencesItem,
  modelPreferencesFiles,
  modelPreferencesDefinition,
};
