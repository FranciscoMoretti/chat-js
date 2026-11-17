import type { RegistryItem } from "shadcn/schema";
import registryPackage from "./package.json";

export const spreadsheetGridItem: RegistryItem = {
  name: "spreadsheet-grid",
  type: "registry:item",
  description:
    "Shared spreadsheet grid for document editing and read-only file previews.",
  dependencies: (
    ["papaparse", "@types/papaparse", "react-data-grid", "next-themes"] as const
  ).map((name) => `${name}@${registryPackage.devDependencies[name]}`),
  files: [
    {
      path: "src/ui/spreadsheet/grid.tsx",
      target: "~/chatjs/ui/spreadsheet/grid.tsx",
      type: "registry:file",
    },
  ],
};
