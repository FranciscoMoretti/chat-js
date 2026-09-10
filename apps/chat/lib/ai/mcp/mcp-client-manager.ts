import { invalidateAllMcpCaches } from "./cache";
import { MCPClient } from "./mcp-client";

// Map to store active MCP clients by connector ID
const clientsMap = new Map<string, MCPClient>();

/**
 * Get or create an MCP client for a connector.
 */
export function getOrCreateMcpClient({
  id,
  name,
  url,
  type,
  headers,
}: {
  id: string;
  name: string;
  url: string;
  type: "http" | "sse";
  headers?: Record<string, string>;
}): MCPClient {
  let client = clientsMap.get(id);

  if (!client) {
    client = new MCPClient(id, name, { url, type, headers }, () =>
      invalidateAllMcpCaches(id)
    );
    clientsMap.set(id, client);
  }

  return client;
}

/**
 * Remove an MCP client from the cache and close it.
 */
export async function removeMcpClient(id: string): Promise<void> {
  const client = clientsMap.get(id);
  if (client) {
    await client.close();
    clientsMap.delete(id);
  }
}

/**
 * Create a fresh MCP client for OAuth callback handling.
 * Does NOT use the cache - creates a new instance to avoid state conflicts.
 */
export function createMcpClientForCallback({
  id,
  name,
  url,
  type,
  headers,
}: {
  id: string;
  name: string;
  url: string;
  type: "http" | "sse";
  headers?: Record<string, string>;
}): MCPClient {
  return new MCPClient(id, name, { url, type, headers }, () =>
    invalidateAllMcpCaches(id)
  );
}
