import type { RegistryItem } from "shadcn/schema";

import { pluginDefinitionSchema } from "../../../metadata";

// Canonical MCP implementation; apps/chat contains installed demo copies.
const mcpFiles = [
  "agent/tools/mcp.ts",
  "plugins/mcp/runtime/agent-tools.ts",
  "app/(chat)/settings/connectors/page.tsx",
  "plugins/mcp/routes/connectors-page.tsx",
  "app/(chat)/settings/connectors/[connectorId]/page.tsx",
  "plugins/mcp/routes/connector-page.tsx",
  "app/api/mcp/oauth/callback/route.ts",
  "plugins/mcp/routes/oauth-callback.ts",
  "plugins/mcp/ui/connectors-settings.tsx",
  "plugins/mcp/ui/connector-header.tsx",
  "plugins/mcp/ui/mcp-connect-dialog.tsx",
  "plugins/mcp/ui/mcp-create-dialog.tsx",
  "plugins/mcp/ui/mcp-details-page.tsx",
  "plugins/mcp/composer.tsx",
  "plugins/mcp/db/mcp-schema.ts",
  "plugins/mcp/db/encrypted-text.ts",
  "plugins/mcp/mcp-env.ts",
  "plugins/mcp/settings.ts",
  "plugins/mcp/setup.ts",
  "plugins/mcp/oauth/cache.ts",
  "plugins/mcp/oauth/mcp-client-manager.ts",
  "plugins/mcp/oauth/mcp-client.ts",
  "plugins/mcp/oauth/mcp-fetch.ts",
  "plugins/mcp/oauth/mcp-oauth-provider.ts",
  "plugins/mcp/oauth/oauth-authorization-required-error.ts",
  "plugins/mcp/db/mcp-oauth-lock.ts",
  "plugins/mcp/db/mcp-queries.ts",
  "plugins/mcp/db/mcp-connector-queries.ts",
  "plugins/mcp/db/mcp-oauth-queries.ts",
  "plugins/mcp/runtime/mcp-tools.ts",
  "plugins/mcp/runtime/mcp-adapter.ts",
  "plugins/mcp/search/mcp-search-params.ts",
  "plugins/mcp/search/mcp-search-params.server.ts",
  "plugins/mcp/router.ts",
  "plugins/mcp/client-plugin.ts",
  "plugins/mcp/server-plugin.ts",
];

const mcpDefinition = pluginDefinitionSchema.parse({
  contractVersion: 2,
  uiBase: "base",
  databaseSchemas: ["plugins/mcp/db/mcp-schema.ts"],
  environmentValidation: "mcp-env.ts",
  envRequirements: [{ options: [["MCP_ENCRYPTION_KEY"]] }],
  id: "mcp",
  kind: "plugin",
  files: mcpFiles,
  server: { export: "mcp", routers: ["mcp"] },
  client: {
    export: "mcpClient",
    composerControls: ["mcp"],
    settingsItems: ["mcp"],
  },
});

const mcpItem: RegistryItem = {
  dependencies: [
    "@ai-sdk/mcp",
    "@hookform/resolvers",
    "@modelcontextprotocol/sdk",
    "@tanstack/react-query",
    "@trpc/server",
    "ajv",
    "drizzle-orm",
    "guarded-fetch",
    "lucide-react",
    "nuqs",
    "postgres",
    "react-hook-form",
    "sonner",
    "superjson",
  ],
  description: "MCP connectors, management pages, OAuth and composer control",
  files: mcpFiles.map((file) => ({
    path: file.startsWith("plugins/mcp/")
      ? `src/plugins/mcp/src/${file.slice("plugins/mcp/".length)}`
      : `src/plugins/mcp/adapters/${file}`,
    target: `~/${file}`,
    type: "registry:file" as const,
  })),
  meta: {
    chatjs: mcpDefinition,
  },
  name: "mcp",
  type: "registry:item",
};
export { mcpDefinition, mcpFiles, mcpItem };
