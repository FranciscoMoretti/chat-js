import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const modelPreferencesFiles = [
  "chatjs/plugins/model-preferences/apply-model-preferences.ts",
  "chatjs/plugins/model-preferences/client-plugin.ts",
  "chatjs/plugins/model-preferences/settings-link.tsx",
  "chatjs/plugins/model-preferences/model-preferences-queries.ts",
  "chatjs/plugins/model-preferences/model-preferences-schema.ts",
  "chatjs/plugins/model-preferences/model-row.tsx",
  "chatjs/plugins/model-preferences/models-page.tsx",
  "chatjs/plugins/model-preferences/models-settings.tsx",
  "chatjs/plugins/model-preferences/models-table.tsx",
  "chatjs/plugins/model-preferences/router.ts",
  "chatjs/plugins/model-preferences/server-plugin.ts",
  "chatjs/plugins/model-preferences/use-model-preferences.ts",
  "app/(chat)/settings/models/page.tsx",
];
const modelPreferencesDefinition = pluginDefinitionSchema.parse({
  contractVersion: 2,
  uiBase: "base",
  id: "model-preferences",
  kind: "plugin",
  files: modelPreferencesFiles,
  databaseSchemas: [
    "chatjs/plugins/model-preferences/model-preferences-schema.ts",
  ],
  server: { export: "modelPreferences", routers: ["modelPreferences"] },
  client: {
    export: "modelPreferencesClient",
    settingsItems: ["models"],
    modelVisibility: true,
  },
});
const modelPreferencesItem: RegistryItem = {
  name: "model-preferences",
  type: "registry:item",
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
  meta: { chatjs: modelPreferencesDefinition },
};
export {
  modelPreferencesItem,
  modelPreferencesFiles,
  modelPreferencesDefinition,
};
