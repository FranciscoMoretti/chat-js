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
      "Remove a document from this conversation with explicit owner approval",
    files: documentFiles("delete-document", [
      "tool.ts",
      "execute.ts",
      "schemas.ts",
      "availability.ts",
    ]),
    meta: {
      chatjs: toolDefinitionSchema.parse({
        availabilityExport: "deleteDocumentAvailable",
        contractVersion: 1,
        id: "delete-document",
        kind: "tool",
        requiresTools: ["readDocument"],
        tools: [{ toolExport: "deleteDocument" }],
      }),
    },
    name: "delete-document",
    registryDependencies: ["@chatjs/read-document"],
    type: "registry:item",
  },
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
          {
            composer: { icon: "Edit3", name: "Canvas", shortName: "Canvas" },
            toolExport: `create${title}Document`,
          },
          {
            composer: { icon: "Edit3", name: "Canvas", shortName: "Canvas" },
            toolExport: `edit${title}Document`,
          },
        ],
      }),
    },
    name: `${kind}-documents`,
    registryDependencies: ["@chatjs/read-document"],
    type: "registry:item" as const,
  })),
];

export const savedCodeExecutionItem: RegistryItem = {
  description: "Run saved code revisions with a compatible installed executor",
  files: documentFiles("saved-code-execution", [
    "tool.ts",
    "execute.ts",
    "schemas.ts",
    "document.tsx",
    "document-runs.ts",
    "renderer.tsx",
    "result.tsx",
  ]),
  meta: {
    chatjs: toolDefinitionSchema.parse({
      contractVersion: 1,
      documentRunExport: "EveDocumentRun",
      id: "saved-code-execution",
      kind: "tool",
      requiresTools: ["createCodeDocument", "readDocument", "codeExecution"],
      tools: [
        { rendererExport: "SavedCodeRenderer", toolExport: "runCodeDocument" },
      ],
    }),
  },
  name: "saved-code-execution",
  registryDependencies: ["@chatjs/code-documents", "@chatjs/code-execution-ui"],
  type: "registry:item",
};

export const codeExecutionUiItem: RegistryItem = {
  dependencies: ["echarts", "echarts-for-react", "motion"],
  description: "Shared chart renderer for installed code execution tools",
  files: [
    "code-execution-chart.tsx",
    "interactive-charts.tsx",
    "interactive-chart-impl.tsx",
  ].map((file) => ({
    path: `src/ui/code-execution/${file}`,
    target: `~/tools/chatjs/_shared/code-execution/${file}`,
    type: "registry:file",
  })),
  name: "code-execution-ui",
  type: "registry:item",
};
