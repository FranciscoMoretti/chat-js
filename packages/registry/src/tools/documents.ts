import type { RegistryItem } from "shadcn/schema";

import { toolDefinitionSchema } from "../../metadata";
import registryPackage from "../../package.json";

const documentFiles = (id: string, files: string[]) =>
  files.map((file) => ({
    path: `src/tools/${id}/${file}`,
    target: `~/tools/chatjs/${id}/${file}`,
    type: "registry:file" as const,
  }));

const bundles = [
  {
    dependencies: [
      "@lexical/code",
      "@lexical/link",
      "@lexical/list",
      "@lexical/markdown",
      "@lexical/react",
      "@lexical/rich-text",
      "lexical",
      "diff",
    ],
    files: ["comparison.tsx", "diffview.tsx", "editor-config.ts"],
    kind: "text",
    title: "Text",
  },
  {
    dependencies: [
      "@codemirror/lang-javascript",
      "@codemirror/lang-python",
      "@codemirror/state",
      "@codemirror/theme-one-dark",
      "@codemirror/view",
      "codemirror",
    ],
    files: [],
    kind: "code",
    title: "Code",
  },
  {
    dependencies: ["papaparse", "@types/papaparse", "react-data-grid"],
    files: [],
    kind: "sheet",
    title: "Sheet",
  },
] as const;

export const documentItems: RegistryItem[] = [
  {
    description:
      "Read an owned document and its current revision before editing",
    files: documentFiles("read-document", ["tool.ts"]),
    meta: {
      chatjs: toolDefinitionSchema.parse({
        contractVersion: 1,
        id: "read-document",
        kind: "tool",

        tools: [{ toolExport: "readDocument" }],
      }),
    },
    name: "read-document",
    type: "registry:item",
  },
  ...bundles.map(({ kind, title, files, dependencies }) => ({
    dependencies: dependencies.map(
      (name) => `${name}@${registryPackage.devDependencies[name]}`
    ),
    description: `Create and edit ${kind} documents with their editor UI`,
    files: documentFiles(`${kind}-documents`, [
      "tool.ts",
      "guidelines.ts",
      "document.tsx",
      "editor.tsx",
      ...files,
    ]),
    meta: {
      chatjs: toolDefinitionSchema.parse({
        contractVersion: 1,
        documentKind: kind,
        id: `${kind}-documents`,
        kind: "tool",
        requiresTools: ["readDocument"],
        tools: [
          { toolExport: `create${title}Document` },
          { toolExport: `edit${title}Document` },
        ],
      }),
    },
    name: `${kind}-documents`,
    registryDependencies: ["@chatjs/read-document"],
    type: "registry:item" as const,
  })),
];
