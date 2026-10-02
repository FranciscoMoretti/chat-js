import { revalidateTag, unstable_cache } from "next/cache";

import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("mcp-cache");

// Cache tags
const mcpCacheTags = {
  connectionStatus: (connectorId: string) =>
    `mcp-connection-status-${connectorId}`,
  discovery: (connectorId: string) => `mcp-discovery-${connectorId}`,
} as const;

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

/**
 * Create a cached connection status fetcher for a specific connector.
 * Successful connection status is cached for 60 seconds. Failures are not cached.
 */
class UncachedConnectionStatusError extends Error {
  readonly result: ConnectionStatusResult;

  constructor(result: ConnectionStatusResult) {
    super("MCP connection status is unavailable");
    this.name = "UncachedConnectionStatusError";
    this.result = result;
  }
}

export const createCachedConnectionStatus = (
  connectorId: string,
  fetcher: () => Promise<ConnectionStatusResult>
) => {
  const cached = unstable_cache(
    async () => {
      const result = await fetcher();
      if (result.error || result.status !== "connected") {
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

/**
 * Invalidate connection status cache for a connector.
 * Call this on: auth errors, disconnect, OAuth completion
 */
const invalidateConnectionStatus = (connectorId: string) => {
  log.debug({ connectorId }, "Invalidating connection status cache");
  revalidateTag(mcpCacheTags.connectionStatus(connectorId), { expire: 0 });
};

/**
 * Invalidate discovery cache for a connector.
 * Call this on: disconnect, OAuth completion, refreshClient
 */
const invalidateDiscovery = (connectorId: string) => {
  log.debug({ connectorId }, "Invalidating discovery cache");
  revalidateTag(mcpCacheTags.discovery(connectorId), { expire: 0 });
};

/**
 * Invalidate all MCP caches for a connector.
 */
export const invalidateAllMcpCaches = (connectorId: string) => {
  invalidateConnectionStatus(connectorId);
  invalidateDiscovery(connectorId);
};
