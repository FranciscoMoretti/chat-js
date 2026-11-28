import { definePluginItem } from "../define-item";

export const modelPickerItem = definePluginItem(
  {
    name: "model-picker",
    title: "Model picker",
    description: "Choose one model for each turn in the composer.",
    registryDependencies: ["@chatjs/model-selector-ui"],
    files: ["single-model-picker.tsx", "turn-models.ts"].map((file) => ({
      path: `src/plugins/model-picker/src/${file}`,
      target: `~/chatjs/plugins/model-picker/${file}`,
      type: "registry:file",
    })),
  },
  { uiBase: "base" }
);
