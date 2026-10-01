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
 * Cache duration: 5 minutes
 */
export const createCachedConnectionStatus = (
  connectorId: string,
  fetcher: () => Promise<ConnectionStatusResult>
) =>
  unstable_cache(
    () => {
      log.debug({ connectorId }, "Fetching connection status (cache miss)");
      return fetcher();
    },
    ["mcp-connection-status", connectorId],
    {
      revalidate: 300,
      tags: [mcpCacheTags.connectionStatus(connectorId)],
    }
  );

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
  revalidateTag(mcpCacheTags.connectionStatus(connectorId), "max");
};

/**
 * Invalidate discovery cache for a connector.
 * Call this on: disconnect, OAuth completion, refreshClient
 */
const invalidateDiscovery = (connectorId: string) => {
  log.debug({ connectorId }, "Invalidating discovery cache");
  revalidateTag(mcpCacheTags.discovery(connectorId), "max");
};

/**
 * Invalidate all MCP caches for a connector.
 */
export const invalidateAllMcpCaches = (connectorId: string) => {
  invalidateConnectionStatus(connectorId);
  invalidateDiscovery(connectorId);
};
