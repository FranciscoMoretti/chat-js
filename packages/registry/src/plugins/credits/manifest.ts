import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const creditsFiles = [
  "chatjs/plugins/credits/balance.tsx",
  "chatjs/plugins/credits/billing.ts",
  "chatjs/plugins/credits/client-plugin.ts",
  "chatjs/plugins/credits/credits-queries.ts",
  "chatjs/plugins/credits/credits-schema.ts",
  "chatjs/plugins/credits/router.ts",
  "chatjs/plugins/credits/server-plugin.ts",
  "chatjs/plugins/credits/use-credits.ts",
];
const creditsDefinition = pluginDefinitionSchema.parse({
  contractVersion: 2,
  uiBase: "base",
  id: "credits",
  kind: "plugin",
  files: creditsFiles,
  databaseSchemas: ["chatjs/plugins/credits/credits-schema.ts"],
  server: { export: "credits", routers: ["credits"] },
  billing: { export: "creditsBilling" },
  client: { export: "creditsClient", accountSummary: true },
});
const creditsItem: RegistryItem = {
  name: "credits",
  type: "registry:item",
  dependencies: ["@tanstack/react-query", "drizzle-orm", "lucide-react"],
  description: "Credit balances, spending admission, and atomic usage debits",
  files: creditsFiles.map((file) => ({
    path: `src/plugins/credits/src/${file.slice("chatjs/plugins/credits/".length)}`,
    target: `~/${file}`,
    type: "registry:file" as const,
  })),
  meta: { chatjs: creditsDefinition },
};
export { creditsItem, creditsFiles, creditsDefinition };
