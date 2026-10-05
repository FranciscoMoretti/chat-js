import { invalidateAllMcpCaches } from "@/lib/ai/mcp/cache";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { MCPClient } from "@/lib/ai/mcp/mcp-client";
/* oxlint-enable sort-imports */

// Map to store active MCP clients by connector ID
const clientsMap = new Map<string, MCPClient>();

/**
 * Get or create an MCP client for a connector.
 * @param {Readonly<{ id: string; name: string; url: string; type: "http" | "sse"; headers?: Readonly<Record<string, string>>; oauthClientId?: string | null; oauthClientSecret?: string | null; }>} options - Connector identity and transport configuration.
 * @returns {MCPClient} The cached client, creating it when absent.
 */
const getOrCreateMcpClient = (
  options: Readonly<{
    id: string;
    name: string;
    url: string;
    type: "http" | "sse";
    headers?: Readonly<Record<string, string>>;
    oauthClientId?: string | null;
    oauthClientSecret?: string | null;
  }>
): MCPClient => {
  const { id, name, url, type, headers, oauthClientId, oauthClientSecret } =
    options;
  let client = clientsMap.get(id);
  if (!client) {
    client = new MCPClient(
      id,
      name,
      { headers, oauthClientId, oauthClientSecret, type, url },
      () => invalidateAllMcpCaches(id)
    );
    clientsMap.set(id, client);
  }
  return client;
};

/**
 * Remove an MCP client from the cache and close it.
 * @param {string} id - Connector whose client should close.
 * @param {string | undefined} expectedOAuthState - When supplied, only close the matching authorizing client.
 */
const removeMcpClient = async (
  id: string,
  expectedOAuthState?: string
): Promise<void> => {
  const client = clientsMap.get(id);
  if (client) {
    if (
      typeof expectedOAuthState === "string" &&
      (client.status !== "authorizing" ||
        client.getAuthorizationUrl()?.searchParams.get("state") !==
          expectedOAuthState)
    ) {
      return;
    }
    clientsMap.delete(id);
    await client.close();
  }
};

/**
 * Create a fresh MCP client for OAuth callback handling.
 * Does NOT use the cache - creates a new instance to avoid state conflicts.
 * @param {Readonly<{ id: string; name: string; url: string; type: "http" | "sse"; headers?: Readonly<Record<string, string>>; oauthClientId?: string | null; oauthClientSecret?: string | null; }>} options - Connector identity and transport configuration.
 * @returns {MCPClient} A fresh client independent of the active client cache.
 */
const createMcpClientForCallback = (
  options: Readonly<{
    id: string;
    name: string;
    url: string;
    type: "http" | "sse";
    headers?: Readonly<Record<string, string>>;
    oauthClientId?: string | null;
    oauthClientSecret?: string | null;
  }>
): MCPClient => {
  const { id, name, url, type, headers, oauthClientId, oauthClientSecret } =
    options;
  return new MCPClient(
    id,
    name,
    { headers, oauthClientId, oauthClientSecret, type, url },
    () => invalidateAllMcpCaches(id)
  );
};
export { createMcpClientForCallback, getOrCreateMcpClient, removeMcpClient };
