import { definePluginItem } from "../define-item";
import registryPackage from "../../../package.json";

const files = ["chat-ui.ts", "viewer-action.tsx", "load.ts", "preview.tsx"];
export const spreadsheetViewerItem = definePluginItem(
  {
    name: "spreadsheet-viewer",
    title: "Spreadsheet viewer",
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
  },
  {
    uiBase: "base",
  }
);
