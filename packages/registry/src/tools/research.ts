import type { RegistryItem } from "shadcn/schema";

import { toolDefinitionSchema } from "../../metadata";

const researchAgentFiles = [
  "agent/tools/deepResearch.ts",
  ...[
    "configuration.ts",
    "delivery.ts",
    "prompts.ts",
    "schemas.ts",
    "steps.ts",
    "workspace.ts",
  ].map((file) => `agent/lib/research/${file}`),
];
const researchAgentDirectories = ["agent/lib/research"];

const researchItem: RegistryItem = {
  dependencies: ["lucide-react"],
  description:
    "Research with installed EVE capabilities; produces a sandbox report. ChatJS adds optional progress UI.",
  files: [
    ...[
      "renderer.tsx",
      "progress-panel.tsx",
      "tool.ts",
      "progress.tsx",
      "task.tsx",
      "schemas.ts",
      "tasks.tsx",
    ].map((file) => ({
      path: `src/tools/deep-research/${file}`,
      target: `~/chatjs/tools/deep-research/${file}`,
      type: "registry:file" as const,
    })),
    ...researchAgentFiles.map((file) => ({
      path: `src/tools/deep-research/${file.replace("deepResearch.ts", "deep-research.ts")}`,
      target: `~/${file}`,
      type: "registry:file" as const,
    })),
  ],
  meta: {
    chatjs: toolDefinitionSchema.parse({
      agentCategory: "extension",
      contractVersion: 1,
      id: "deep-research",
      kind: "tool",
      requiresChatJS: false,
      native: {
        layout: "agent",
        files: researchAgentFiles.map((file) => file.slice("agent/".length)),
        dependencies: ["eve", "zod"],
        fileSources: {
          "lib/research/delivery.ts":
            "src/tools/deep-research/agent/lib/research/delivery.native.ts",
        },
      },
      tools: [
        {
          composer: {
            icon: "Telescope",
            name: "Deep Research",
            shortName: "Research",
          },
          rendererExport: "DeepResearchRenderer",
          toolExport: "deepResearch",
          workflow: true,
          accounting: "none",
        },
      ],
    }),
  },
  name: "deep-research",
  type: "registry:item",
};
export { researchAgentDirectories, researchAgentFiles, researchItem };
