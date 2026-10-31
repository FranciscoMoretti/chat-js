import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const aiTitlesFiles = [
  "chatjs/plugins/ai-titles/chat.ts",
  "chatjs/plugins/ai-titles/generate-title.ts",
  "chatjs/plugins/ai-titles/title-queries.ts",
];
const aiTitlesDefinition = pluginDefinitionSchema.parse({
  contractVersion: 1,
  id: "ai-titles",
  kind: "plugin",
  files: aiTitlesFiles,
  chat: { export: "aiTitlesChat" },
});
const aiTitlesItem: RegistryItem = {
  name: "ai-titles",
  type: "registry:item",
  dependencies: ["drizzle-orm"],
  description: "Automatically name new chats with AI",
  files: aiTitlesFiles.map((file) => ({
    path: `src/plugins/ai-titles/src/${file.slice("chatjs/plugins/ai-titles/".length)}`,
    target: `~/${file}`,
    type: "registry:file" as const,
  })),
  meta: { chatjs: aiTitlesDefinition },
};
export { aiTitlesItem, aiTitlesFiles, aiTitlesDefinition };
