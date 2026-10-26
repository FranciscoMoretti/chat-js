import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const creditsFiles = [
  "plugins/credits/balance.tsx",
  "plugins/credits/billing.ts",
  "plugins/credits/client-plugin.ts",
  "plugins/credits/credits-queries.ts",
  "plugins/credits/credits-schema.ts",
  "plugins/credits/router.ts",
  "plugins/credits/server-plugin.ts",
  "plugins/credits/use-credits.ts",
];
const creditsDefinition = pluginDefinitionSchema.parse({
  contractVersion: 2,
  uiBase: "base",
  id: "credits",
  kind: "plugin",
  files: creditsFiles,
  databaseSchemas: ["plugins/credits/credits-schema.ts"],
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
    path: `src/plugins/credits/src/${file.slice("plugins/credits/".length)}`,
    target: `~/${file}`,
    type: "registry:file" as const,
  })),
  meta: { chatjs: creditsDefinition },
};
export { creditsItem, creditsFiles, creditsDefinition };
