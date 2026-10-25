import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const feedbackFiles = [
  "plugins/feedback/chat.ts",
  "plugins/feedback/client-plugin.ts",
  "plugins/feedback/feedback-actions.tsx",
  "plugins/feedback/message-vote-actions.tsx",
  "plugins/feedback/feedback-queries.ts",
  "plugins/feedback/router.ts",
  "plugins/feedback/feedback-schema.ts",
  "plugins/feedback/server-plugin.ts",
  "plugins/feedback/vote-message.ts",
];
const feedbackDefinition = pluginDefinitionSchema.parse({
  contractVersion: 1,
  id: "feedback",
  kind: "plugin",
  files: feedbackFiles,
  databaseSchemas: ["plugins/feedback/feedback-schema.ts"],
  server: { export: "feedback", routers: ["feedback"] },
  chat: { export: "feedbackChat" },
  client: { export: "feedbackClient", chat: true },
});
const feedbackItem: RegistryItem = {
  name: "feedback",
  type: "registry:item",
  description: "Private feedback on assistant messages",
  files: feedbackFiles.map((file) => ({
    path: `src/plugins/feedback/src/${file.slice("plugins/feedback/".length)}`,
    target: `~/${file}`,
    type: "registry:file" as const,
  })),
  meta: { chatjs: feedbackDefinition },
};
export { feedbackItem, feedbackFiles, feedbackDefinition };
