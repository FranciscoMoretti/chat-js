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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve removeMcpClient's awaited sequencing and rejected-Promise behavior. */
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
        // oxlint-disable-next-line oxc/no-optional-chaining -- Client existence guard does not establish authorization URL presence. getAuthorizationUrl returns the class optional authorizationUrl state; an authorizing client without matching URL/state must be rejected without throwing.
        client.getAuthorizationUrl()?.searchParams.get("state") !==
          expectedOAuthState)
    ) {
      return;
    }
    clientsMap.delete(id);
    await client.close();
  }
};
/* oxlint-enable oxc/no-async-await */
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (createMcpClientForCallback, getOrCreateMcpClient, removeMcpClient); the enabled import/no-default-export convention rejects the default-export alternative. */
export { createMcpClientForCallback, getOrCreateMcpClient, removeMcpClient };
/* oxlint-enable import/no-named-export */
