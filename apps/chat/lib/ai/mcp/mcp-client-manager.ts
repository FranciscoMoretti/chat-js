import { invalidateAllMcpCaches } from "@/lib/ai/mcp/cache";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { MCPClient } from "@/lib/ai/mcp/mcp-client";
/* oxlint-enable eslint/sort-imports */

// Map to store active MCP clients by connector ID
const clientsMap = new Map<string, MCPClient>();

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable import/no-named-export */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
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
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable import/no-named-export */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable import/group-exports */
