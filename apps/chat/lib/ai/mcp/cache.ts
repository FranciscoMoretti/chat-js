import { revalidateTag, unstable_cache } from "next/cache";

import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("mcp-cache");

// Cache tags
const mcpCacheTags = {
  connectionStatus: (connectorId: string): string =>
    `mcp-connection-status-${connectorId}`,
  discovery: (connectorId: string): string => `mcp-discovery-${connectorId}`,
} as const;

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
// Types for cached results
export interface ConnectionStatusResult {
  error?: string;
  needsAuth: boolean;
  status:
    | "disconnected"
    | "connecting"
    | "connected"
    | "authorizing"
    | "incompatible";
}
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export interface DiscoveryResult {
  prompts: {
    name: string;
    description: string | null;
    arguments: {
      name: string;
      description: string | null;
      required: boolean;
    }[];
  }[];
  resources: {
    name: string;
    uri: string;
    description: string | null;
    mimeType: string | null;
  }[];
  tools: { name: string; description: string | null }[];
}
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/**
 * Create a cached connection status fetcher for a specific connector.
 * Successful connection status is cached for 60 seconds. Failures are not cached.
 */
class UncachedConnectionStatusError extends Error {
  public readonly result: ConnectionStatusResult;

  public constructor(result: ConnectionStatusResult) {
    super("MCP connection status is unavailable");
    this.name = "UncachedConnectionStatusError";
    this.result = result;
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
export const createCachedConnectionStatus = (
  connectorId: string,
  fetcher: () => Promise<ConnectionStatusResult>
) => {
  const cached = unstable_cache(
    async () => {
      const result = await fetcher();
      if (
        (typeof result.error === "string" && result.error !== "") ||
        result.status !== "connected"
      ) {
        throw new UncachedConnectionStatusError(result);
      }
      return result;
    },
    ["mcp-connection-status", connectorId],
    {
      revalidate: 60,
      tags: [mcpCacheTags.connectionStatus(connectorId)],
    }
  );
  return async () => {
    try {
      return await cached();
    } catch (error) {
      if (error instanceof UncachedConnectionStatusError) {
        return error.result;
      }
      throw error;
    }
  };
};
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/**
 * Create a cached discovery fetcher for a specific connector.
 * Cache duration: 5 minutes (tools/resources/prompts rarely change)
 */
export const createCachedDiscovery = (
  connectorId: string,
  fetcher: () => Promise<DiscoveryResult>
) =>
  unstable_cache(
    () => {
      log.debug({ connectorId }, "Fetching discovery (cache miss)");
      return fetcher();
    },
    ["mcp-discovery", connectorId],
    {
      revalidate: 300,
      tags: [mcpCacheTags.discovery(connectorId)],
    }
  );
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/**
 * Invalidate connection status cache for a connector.
 * Call this on: auth errors, disconnect, OAuth completion
 */
const invalidateConnectionStatus = (connectorId: string): void => {
  log.debug({ connectorId }, "Invalidating connection status cache");
  revalidateTag(mcpCacheTags.connectionStatus(connectorId), { expire: 0 });
};
/* oxlint-enable jsdoc/require-param */

/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/**
 * Invalidate discovery cache for a connector.
 * Call this on: disconnect, OAuth completion, refreshClient
 */
const invalidateDiscovery = (connectorId: string): void => {
  log.debug({ connectorId }, "Invalidating discovery cache");
  revalidateTag(mcpCacheTags.discovery(connectorId), { expire: 0 });
};
/* oxlint-enable jsdoc/require-param */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/**
 * Invalidate all MCP caches for a connector.
 */
export const invalidateAllMcpCaches = (connectorId: string): void => {
  invalidateConnectionStatus(connectorId);
  invalidateDiscovery(connectorId);
};
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable import/group-exports */
