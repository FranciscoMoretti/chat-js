import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const aiTitlesFiles = [
  "plugins/ai-titles/chat.ts",
  "plugins/ai-titles/generate-title.ts",
  "plugins/ai-titles/title-queries.ts",
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
  description: "Automatically name new chats with AI",
  files: aiTitlesFiles.map((file) => ({
    path: `src/plugins/ai-titles/src/${file.slice("plugins/ai-titles/".length)}`,
    target: `~/${file}`,
    type: "registry:file" as const,
  })),
  meta: { chatjs: aiTitlesDefinition },
};
export { aiTitlesItem, aiTitlesFiles, aiTitlesDefinition };
