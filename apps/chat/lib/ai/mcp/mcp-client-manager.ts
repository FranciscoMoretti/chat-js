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
}: {
  id: string;
  name: string;
  url: string;
  type: "http" | "sse";
  headers?: Record<string, string>;
}): MCPClient => {
  let client = clientsMap.get(id);
  if (!client) {
    client = new MCPClient(id, name, { headers, type, url }, () =>
      invalidateAllMcpCaches(id)
    );
    clientsMap.set(id, client);
  }
  return client;
};

/**
 * Remove an MCP client from the cache and close it.
 */
export const removeMcpClient = async (id: string): Promise<void> => {
  const client = clientsMap.get(id);
  if (client) {
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
}: {
  id: string;
  name: string;
  url: string;
  type: "http" | "sse";
  headers?: Record<string, string>;
}): MCPClient =>
  new MCPClient(id, name, { headers, type, url }, () =>
    invalidateAllMcpCaches(id)
  );
