import type { RegistryItem } from "shadcn/schema";

export const modelLogoItem: RegistryItem = {
  name: "model-logo",
  type: "registry:item",
  description: "Display the provider logo of a chat model.",
  files: [
    {
      path: "src/ui/model-logo.tsx",
      target: "~/chatjs/ui/model-logo.tsx",
      type: "registry:file",
    },
  ],
};

export const modelSelectorUiItem: RegistryItem = {
  name: "model-selector-ui",
  type: "registry:item",
  description:
    "Model search, filters and option rows shared by the composer pickers.",
  registryDependencies: ["@chatjs/model-logo"],
  dependencies: ["@base-ui/react", "cmdk", "lucide-react"],
  files: [
    "model-selector.tsx",
    "model-selector-view.tsx",
    "use-optimistic-model-selection.ts",
  ].map((file) => ({
    path: `src/ui/model-selector/${file}`,
    target: `~/chatjs/ui/model-selector/${file}`,
    type: "registry:file",
  })),
};
