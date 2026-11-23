import { definePluginItem } from "../define-item";

const creditsFiles = [
  "chatjs/plugins/credits/balance.tsx",
  "chatjs/plugins/credits/billing.ts",
  "chatjs/plugins/credits/chat-ui.ts",
  "chatjs/plugins/credits/credits-queries.ts",
  "chatjs/plugins/credits/credits-schema.ts",
  "chatjs/plugins/credits/router.ts",
  "chatjs/plugins/credits/use-credits.ts",
];

const creditsItem = definePluginItem(
  {
    name: "credits",
    dependencies: ["@tanstack/react-query", "drizzle-orm", "lucide-react"],
    description: "Credit balances, spending admission, and atomic usage debits",
    files: creditsFiles.map((file) => ({
      path: `src/plugins/credits/src/${file.slice("chatjs/plugins/credits/".length)}`,
      target: `~/${file}`,
      type: "registry:file" as const,
    })),
  },
  {
    uiBase: "base",
    databaseSchemas: ["chatjs/plugins/credits/credits-schema.ts"],
  }
);
const creditsDefinition = creditsItem.meta.chatjs;
export { creditsItem, creditsFiles, creditsDefinition };
