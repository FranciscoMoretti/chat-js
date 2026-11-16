import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";
import registryPackage from "../../../package.json";

const files = [
  "client-plugin.ts",
  "viewer-action.tsx",
  "load.ts",
  "preview.tsx",
];
export const spreadsheetViewerItem: RegistryItem = {
  name: "spreadsheet-viewer",
  title: "Spreadsheet viewer",
  type: "registry:item",
  description:
    "Preview CSV, TSV and XLSX files in a read-only grid, with worksheet selection.",
  dependencies: [
    `read-excel-file@${registryPackage.devDependencies["read-excel-file"]}`,
    "lucide-react",
    "papaparse",
    "@types/papaparse",
  ],
  registryDependencies: ["@chatjs/spreadsheet-grid"],
  files: files.map((file) => ({
    path: `src/plugins/spreadsheet-viewer/src/${file}`,
    target: `~/chatjs/plugins/spreadsheet-viewer/${file}`,
    type: "registry:file" as const,
  })),
  meta: {
    chatjs: pluginDefinitionSchema.parse({
      contractVersion: 2,
      uiBase: "base",
      id: "spreadsheet-viewer",
      kind: "plugin",
      files: files.map((file) => `chatjs/plugins/spreadsheet-viewer/${file}`),
      client: { export: "spreadsheetViewerClient", chat: true },
    }),
  },
};
