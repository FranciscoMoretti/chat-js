import { invalidateAllMcpCaches } from "@/lib/ai/mcp/cache";
import { MCPClient } from "@/lib/ai/mcp/mcp-client";

// Map to store active MCP clients by connector ID
const clientsMap = new Map<string, MCPClient>();

/**
 * Get or create an MCP client for a connector.
 */
export const getOrCreateMcpClient = ({
  id,
  name,
  url,
  type,
  headers,
  oauthClientId,
  oauthClientSecret,
}: {
  id: string;
  name: string;
  url: string;
  type: "http" | "sse";
  headers?: Record<string, string>;
  oauthClientId?: string | null;
  oauthClientSecret?: string | null;
}): MCPClient => {
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
 */
export const removeMcpClient = async (
  id: string,
  expectedOAuthState?: string
): Promise<void> => {
  const client = clientsMap.get(id);
  if (client) {
    if (
      expectedOAuthState !== undefined &&
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
 */
export const createMcpClientForCallback = ({
  id,
  name,
  url,
  type,
  headers,
  oauthClientId,
  oauthClientSecret,
}: {
  id: string;
  name: string;
  url: string;
  type: "http" | "sse";
  headers?: Record<string, string>;
  oauthClientId?: string | null;
  oauthClientSecret?: string | null;
}): MCPClient =>
  new MCPClient(
    id,
    name,
    { headers, oauthClientId, oauthClientSecret, type, url },
    () => invalidateAllMcpCaches(id)
  );
