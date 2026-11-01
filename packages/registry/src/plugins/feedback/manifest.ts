import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const feedbackFiles = [
  "chatjs/plugins/feedback/chat.ts",
  "chatjs/plugins/feedback/client-plugin.ts",
  "chatjs/plugins/feedback/feedback-actions.tsx",
  "chatjs/plugins/feedback/message-vote-actions.tsx",
  "chatjs/plugins/feedback/feedback-queries.ts",
  "chatjs/plugins/feedback/router.ts",
  "chatjs/plugins/feedback/feedback-schema.ts",
  "chatjs/plugins/feedback/server-plugin.ts",
  "chatjs/plugins/feedback/vote-message.ts",
];
const feedbackDefinition = pluginDefinitionSchema.parse({
  contractVersion: 2,
  uiBase: "base",
  id: "feedback",
  kind: "plugin",
  files: feedbackFiles,
  databaseSchemas: ["chatjs/plugins/feedback/feedback-schema.ts"],
  server: { export: "feedback", routers: ["feedback"] },
  chat: { export: "feedbackChat" },
  client: { export: "feedbackClient", chat: true },
});
const feedbackItem: RegistryItem = {
  dependencies: [
    "@tanstack/react-query",
    "@trpc/server",
    "drizzle-orm",
    "lucide-react",
    "sonner",
  ],
  name: "feedback",
  type: "registry:item",
  description: "Private feedback on assistant messages",
  files: feedbackFiles.map(
    (file): NonNullable<RegistryItem["files"]>[number] => ({
      path: `src/plugins/feedback/src/${file.slice("chatjs/plugins/feedback/".length)}`,
      target: `~/${file}`,
      type: "registry:file",
    })
  ),
  meta: { chatjs: feedbackDefinition },
};
export { feedbackItem, feedbackFiles, feedbackDefinition };
