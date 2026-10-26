import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const modelPreferencesFiles = [
  "plugins/model-preferences/apply-model-preferences.ts",
  "plugins/model-preferences/client-plugin.ts",
  "plugins/model-preferences/model-preferences-queries.ts",
  "plugins/model-preferences/model-preferences-schema.ts",
  "plugins/model-preferences/model-row.tsx",
  "plugins/model-preferences/models-page.tsx",
  "plugins/model-preferences/models-settings.tsx",
  "plugins/model-preferences/models-table.tsx",
  "plugins/model-preferences/router.ts",
  "plugins/model-preferences/server-plugin.ts",
  "plugins/model-preferences/use-model-preferences.ts",
  "app/(chat)/settings/models/page.tsx",
];
const modelPreferencesDefinition = pluginDefinitionSchema.parse({
  contractVersion: 2,
  uiBase: "base",
  id: "model-preferences",
  kind: "plugin",
  files: modelPreferencesFiles,
  databaseSchemas: ["plugins/model-preferences/model-preferences-schema.ts"],
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
  description: "Per-user model visibility and model settings",
  files: modelPreferencesFiles.map((file) => ({
    path: file.startsWith("plugins/model-preferences/")
      ? `src/plugins/model-preferences/src/${file.slice("plugins/model-preferences/".length)}`
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
