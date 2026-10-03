import { invalidateAllMcpCaches } from "@/lib/ai/mcp/cache";
import { MCPClient } from "@/lib/ai/mcp/mcp-client";

// Map to store active MCP clients by connector ID
const clientsMap = new Map<string, MCPClient>();

/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/**
 * Get or create an MCP client for a connector.
 */
const getOrCreateMcpClient = ({
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable jsdoc/require-returns */

/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/**
 * Remove an MCP client from the cache and close it.
 */
const removeMcpClient = async (
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
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable jsdoc/require-param */

/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/**
 * Create a fresh MCP client for OAuth callback handling.
 * Does NOT use the cache - creates a new instance to avoid state conflicts.
 */
const createMcpClientForCallback = ({
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable jsdoc/require-returns */
export { createMcpClientForCallback, getOrCreateMcpClient, removeMcpClient };
