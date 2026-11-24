import { definePluginItem } from "../define-item";

const feedbackFiles = [
  "chatjs/plugins/feedback/chat-server.ts",
  "chatjs/plugins/feedback/chat-ui.ts",
  "chatjs/plugins/feedback/feedback-actions.tsx",
  "chatjs/plugins/feedback/message-vote-actions.tsx",
  "chatjs/plugins/feedback/feedback-queries.ts",
  "chatjs/plugins/feedback/router.ts",
  "chatjs/plugins/feedback/feedback-schema.ts",
  "chatjs/plugins/feedback/vote-message.ts",
];

const feedbackItem = definePluginItem(
  {
    dependencies: [
      "@tanstack/react-query",
      "@trpc/server",
      "drizzle-orm",
      "lucide-react",
      "sonner",
    ],
    name: "feedback",
    description: "Private feedback on assistant messages",
    files: feedbackFiles.map((file) => ({
      path: `src/plugins/feedback/src/${file.slice("chatjs/plugins/feedback/".length)}`,
      target: `~/${file}`,
      type: "registry:file",
    })),
  },
  {
    uiBase: "base",
    databaseSchemas: ["chatjs/plugins/feedback/feedback-schema.ts"],
  }
);
const feedbackDefinition = feedbackItem.meta.chatjs;
export { feedbackItem, feedbackFiles, feedbackDefinition };
