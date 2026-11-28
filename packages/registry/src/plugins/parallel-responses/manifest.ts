import { definePluginItem } from "../define-item";

const sourceFiles = [
  "chat-server.ts",
  "chat-ui.ts",
  "create-response-group.ts",
  "eve-logical-group-recovery.tsx",
  "eve-optimistic-response-group.tsx",
  "eve-response-group-cards.tsx",
  "logical-response-slots.ts",
  "parallel-response-picker.tsx",
  "model-selection-indicator.tsx",
  "selected-model-ids.ts",
  "turn-models.ts",
  "submit-turn.ts",
  "creation-handler.ts",
  "response-group-input.ts",
  "response-choice-cards.tsx",
  "response-group-candidates.ts",
  "response-group-contracts.ts",
  "response-group-lineage.ts",
  "response-group-queries.ts",
  "response-group-schema.ts",
  "response-group.ts",
  "responses.tsx",
  "router.ts",
];
export const parallelResponsesItem = definePluginItem(
  {
    name: "parallel-responses",
    title: "Parallel Responses",
    description:
      "Compare independent replies from one or more models and continue from any response.",
    dependencies: [
      "@tanstack/react-query",
      "@trpc/client",
      "@trpc/server",
      "superjson",
      "drizzle-orm",
      "lucide-react",
      "uuid",
    ],
    registryDependencies: ["button", "@chatjs/model-selector-ui"],
    files: sourceFiles.map((file) => ({
      path: `src/plugins/parallel-responses/src/${file}`,
      target: `~/chatjs/plugins/parallel-responses/${file}`,
      type: "registry:file",
    })),
  },
  {
    uiBase: "base",
    databaseSchemas: [
      "chatjs/plugins/parallel-responses/response-group-schema.ts",
    ],
  }
);
