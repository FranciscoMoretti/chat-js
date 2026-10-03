import type { RegistryItem } from "shadcn/schema";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { toolDefinitionSchema } from "../../metadata";
/* oxlint-enable import/no-relative-parent-imports */

const researchAgentFiles = [
  "agent/tools/deepResearch.ts",
  "agent/subagents/researchPlanner/agent.ts",
  "agent/subagents/researchPlanner/hooks/billing.ts",
  "agent/subagents/researchWriter/agent.ts",
  "agent/subagents/researchWriter/hooks/billing.ts",
  "agent/subagents/researchCompressor/agent.ts",
  "agent/subagents/researchCompressor/hooks/billing.ts",
  "agent/subagents/researcher/agent.ts",
  "agent/subagents/researcher/tools/webSearch.ts",
  "agent/subagents/researcher/hooks/billing.ts",
];

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const researchAgentDirectories = [
  ...new Set(
    researchAgentFiles
      .filter((file) => file.startsWith("agent/subagents/"))
      .map((file) => file.split("/").slice(0, 3).join("/"))
  ),
];
/* oxlint-enable eslint/no-magic-numbers */

const researchItem: RegistryItem = {
  description:
    "Native EVE research workflow, subagents, prompts, and progress UI",
  files: [
    ...[
      "renderer.tsx",
      "search-updates.ts",
      "progress-panel.tsx",
      "tool.ts",
      "availability.ts",
      "progress.tsx",
      "workflow.ts",
      "task.tsx",
      "agent.ts",
      "schemas.ts",
      "tasks.tsx",
      "update-title.tsx",
      "prompts.ts",
      "steps.ts",
      "configuration.ts",
    ].map((file) => ({
      path: `src/tools/deep-research/${file}`,
      target: `~/tools/chatjs/deep-research/${file}`,
      type: "registry:file" as const,
    })),
    ...researchAgentFiles.map((file) => ({
      path: `src/tools/deep-research/${file.replace("deepResearch.ts", "deep-research.ts").replace("webSearch.ts", "web-search.ts")}`,
      target: `~/${file}`,
      type: "registry:file" as const,
    })),
  ],
  meta: {
    chatjs: toolDefinitionSchema.parse({
      availabilityExport: "researchAvailable",
      contractVersion: 1,
      id: "deep-research",
      kind: "tool",
      requiresTools: ["createTextDocument", "readDocument", "webSearch"],
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
        },
      ],
    }),
  },
  name: "deep-research",
  registryDependencies: ["@chatjs/text-documents"],
  type: "registry:item",
};
export { researchAgentDirectories, researchAgentFiles, researchItem };
