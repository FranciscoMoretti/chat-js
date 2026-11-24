import { definePluginItem } from "../define-item";

const aiTitlesFiles = [
  "chatjs/plugins/ai-titles/chat.ts",
  "chatjs/plugins/ai-titles/generate-title.ts",
  "chatjs/plugins/ai-titles/title-queries.ts",
];

const aiTitlesItem = definePluginItem({
  name: "ai-titles",
  dependencies: ["drizzle-orm"],
  description: "Automatically name new chats with AI",
  files: aiTitlesFiles.map((file) => ({
    path: `src/plugins/ai-titles/src/${file.slice("chatjs/plugins/ai-titles/".length)}`,
    target: `~/${file}`,
    type: "registry:file" as const,
  })),
});
const aiTitlesDefinition = aiTitlesItem.meta.chatjs;
export { aiTitlesItem, aiTitlesFiles, aiTitlesDefinition };
