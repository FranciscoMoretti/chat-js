import { revalidateTag, unstable_cache } from "next/cache";

import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("mcp-cache");

// Cache tags
const mcpCacheTags = {
  connectionStatus: (connectorId: string): string =>
    `mcp-connection-status-${connectorId}`,
  discovery: (connectorId: string): string => `mcp-discovery-${connectorId}`,
} as const;

// Types for cached results
interface ConnectionStatusResult {
  error?: string;
  needsAuth: boolean;
  status:
    | "disconnected"
    | "connecting"
    | "connected"
    | "authorizing"
    | "incompatible";
}

interface DiscoveryResult {
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
  public readonly result: ConnectionStatusResult;

  public constructor(result: Readonly<ConnectionStatusResult>) {
    super("MCP connection status is unavailable");
    this.name = "UncachedConnectionStatusError";
    this.result = result;
  }
}

const createCachedConnectionStatus = (
  connectorId: string,
  fetcher: () => Promise<ConnectionStatusResult>
): (() => Promise<ConnectionStatusResult>) => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve cached's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve createCachedDiscovery's awaited sequencing and rejected-Promise behavior. */
/**
 * Create a cached discovery fetcher for a specific connector.
 * Cache duration: 5 minutes (tools/resources/prompts rarely change)
 * @param {string} connectorId - Connector whose discovery result is cached.
 * @param {() => Promise<DiscoveryResult>} fetcher - Loads discovery when the cache misses.
 * @returns {(() => Promise<DiscoveryResult>)} A cached discovery loader.
 */
const createCachedDiscovery = (
  connectorId: string,
  fetcher: () => Promise<DiscoveryResult>
): (() => Promise<DiscoveryResult>) =>
  unstable_cache(
    async () => {
      log.debug({ connectorId }, "Fetching discovery (cache miss)");
      return await fetcher();
    },
    ["mcp-discovery", connectorId],
    {
      revalidate: 300,
      tags: [mcpCacheTags.discovery(connectorId)],
    }
  );
/* oxlint-enable oxc/no-async-await */
/**
 * Invalidate connection status cache for a connector.
 * Call this on: auth errors, disconnect, OAuth completion
 * @param {string} connectorId - Connector whose cached results are invalidated.
 */
const invalidateConnectionStatus = (connectorId: string): void => {
  log.debug({ connectorId }, "Invalidating connection status cache");
  revalidateTag(mcpCacheTags.connectionStatus(connectorId), { expire: 0 });
};

/**
 * Invalidate discovery cache for a connector.
 * Call this on: disconnect, OAuth completion, refreshClient
 * @param {string} connectorId - Connector whose cached results are invalidated.
 */
const invalidateDiscovery = (connectorId: string): void => {
  log.debug({ connectorId }, "Invalidating discovery cache");
  revalidateTag(mcpCacheTags.discovery(connectorId), { expire: 0 });
};

/**
 * Invalidate all MCP caches for a connector.
 * @param {string} connectorId - Connector whose cached results are invalidated.
 */
const invalidateAllMcpCaches = (connectorId: string): void => {
  invalidateConnectionStatus(connectorId);
  invalidateDiscovery(connectorId);
};
export {
  createCachedConnectionStatus,
  createCachedDiscovery,
  invalidateAllMcpCaches,
};
export type { ConnectionStatusResult, DiscoveryResult };
