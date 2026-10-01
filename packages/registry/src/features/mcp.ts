import type { RegistryItem } from "shadcn/schema";

import { featureDefinitionSchema } from "../../metadata";

// The demo is the canonical implementation. Registry builds read these files directly.
export const mcpFiles = [
  "agent/tools/mcp.ts",
  "app/(chat)/settings/connectors/page.tsx",
  "app/(chat)/settings/connectors/[connectorId]/page.tsx",
  "app/api/mcp/oauth/callback/route.ts",
  "components/settings/connectors-settings.tsx",
  "components/settings/connector-header.tsx",
  "components/settings/mcp-connect-dialog.tsx",
  "components/settings/mcp-create-dialog.tsx",
  "components/settings/mcp-details-page.tsx",
  "features/mcp/composer.tsx",
  "features/mcp/settings.ts",
  "lib/ai/mcp/cache.ts",
  "lib/ai/mcp/mcp-client-manager.ts",
  "lib/ai/mcp/mcp-client.ts",
  "lib/ai/mcp/mcp-fetch.ts",
  "lib/ai/mcp/mcp-oauth-provider.ts",
  "lib/ai/mcp/oauth-authorization-required-error.ts",
  "lib/db/mcp-oauth-lock.ts",
  "lib/db/mcp-queries.ts",
  "lib/eve/mcp-tools.ts",
  "lib/eve/mcp-adapter.ts",
  "lib/nuqs/mcp-search-params.ts",
  "lib/nuqs/mcp-search-params.server.ts",
  "trpc/routers/mcp.router.ts",
];

export const mcpItem: RegistryItem = {
  description: "MCP connectors, management pages, OAuth and composer control",
  files: mcpFiles.map((file) => ({
    path: `../../apps/chat/${file}`,
    target: `~/${file}`,
    type: "registry:file",
  })),
  meta: {
    chatjs: featureDefinitionSchema.parse({
      contractVersion: 1,
      id: "mcp",
      kind: "feature",
    }),
  },
  name: "mcp",
  type: "registry:item",
};
