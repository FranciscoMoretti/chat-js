import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { generateMcpNameId, MCP_NAME_MAX_LENGTH } from "@/lib/ai/mcp-name-id";
import {
  createCachedConnectionStatus,
  createCachedDiscovery,
  invalidateAllMcpCaches,
} from "@/lib/ai/mcp/cache";
import type {
  ConnectionStatusResult,
  DiscoveryResult,
} from "@/lib/ai/mcp/cache";
import { getOrCreateMcpClient, removeMcpClient } from "@/lib/ai/mcp/mcp-client";
import { config } from "@/lib/config";
import {
  createMcpConnector,
  deleteMcpConnector,
  deleteSessionsByConnectorId,
  getAuthenticatedSession,
  getMcpConnectorById,
  getMcpConnectorByNameId,
  getMcpConnectorsByUserId,
  updateMcpConnector,
} from "@/lib/db/mcp-queries";
import { createModuleLogger } from "@/lib/logger";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

const log = createModuleLogger("mcp.router");

function assertMcpEnabled() {
  if (!config.ai.tools.mcp.enabled) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "MCP integration disabled",
    });
  }
}

/**
 * Validates and generates a nameId from a connector name.
 * Throws TRPCError if the name is invalid or the namespace already exists.
 */
async function validateAndGenerateNameId({
  name,
  userId,
  excludeId,
}: {
  name: string;
  userId: string | null;
  excludeId?: string;
}): Promise<string> {
  assertMcpEnabled();
  const result = generateMcpNameId(name);
  if (!result.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        result.error === "empty"
          ? "Connector name must contain at least one alphanumeric character"
          : 'Connector name cannot be "global" (reserved)',
    });
  }

  const existing = await getMcpConnectorByNameId({
    excludeId,
    nameId: result.nameId,
    userId,
  });

  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `A connector with namespace "${result.nameId}" already exists. Choose a different name.`,
    });
  }

  return result.nameId;
}

type Permission = "own" | "own-or-global";

/**
 * Fetches connector and validates user permission.
 * - "own": user must own the connector (userId === ctx.user.id)
 * - "own-or-global": user must own OR connector is global (userId === null)
 */
async function getConnectorWithPermission({
  id,
  userId,
  permission,
}: {
  id: string;
  userId: string;
  permission: Permission;
}) {
  const connector = await getMcpConnectorById({ id });
  if (!connector) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
  }

  const isOwner = connector.userId === userId;
  const isGlobal = connector.userId === null;

  const hasPermission = permission === "own" ? isOwner : isOwner || isGlobal;

  if (!hasPermission) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot access this connector",
    });
  }

  return connector;
}

export const mcpRouter = createTRPCRouter({
  /**
   * Initiate OAuth authorization for an MCP connector.
   * Returns the authorization URL that the client should open in a popup.
   */
  authorize: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertMcpEnabled();
      const connector = await getConnectorWithPermission({
        id: input.id,
        permission: "own-or-global",
        userId: ctx.user.id,
      });

      log.info({ connectorId: connector.id }, "Initiating OAuth authorization");

      // Remove any existing client to force a fresh connection
      await removeMcpClient(connector.id);

      // Create a new client and attempt to connect
      const mcpClient = getOrCreateMcpClient({
        id: connector.id,
        name: connector.name,
        type: connector.type,
        url: connector.url,
      });

      await mcpClient.connect();

      if (mcpClient.status !== "authorizing") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Connector does not require OAuth authorization",
        });
      }

      const authUrl = mcpClient.getAuthorizationUrl();
      if (!authUrl) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get authorization URL",
        });
      }

      log.info(
        { authUrl: authUrl.toString(), connectorId: connector.id },
        "OAuth authorization URL generated"
      );

      return { authorizationUrl: authUrl.toString() };
    }),

  /**
   * Check if a connector has valid OAuth tokens.
   */
  checkAuth: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      assertMcpEnabled();
      const connector = await getConnectorWithPermission({
        id: input.id,
        permission: "own-or-global",
        userId: ctx.user.id,
      });

      const session = await getAuthenticatedSession({
        mcpConnectorId: connector.id,
      });

      return {
        hasSession: !!session,
        isAuthenticated: !!session?.tokens,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(MCP_NAME_MAX_LENGTH),
        oauthClientId: z.string().optional(),
        oauthClientSecret: z.string().optional(),
        type: z.enum(["http", "sse"]),
        url: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMcpEnabled();
      const nameId = await validateAndGenerateNameId({
        name: input.name,
        userId: ctx.user.id,
      });

      return await createMcpConnector({
        name: input.name,
        nameId,
        oauthClientId: input.oauthClientId,
        oauthClientSecret: input.oauthClientSecret,
        type: input.type,
        url: input.url,
        userId: ctx.user.id,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertMcpEnabled();
      await getConnectorWithPermission({
        id: input.id,
        permission: "own",
        userId: ctx.user.id,
      });
      await deleteMcpConnector({ id: input.id });
      await removeMcpClient(input.id);
      return { success: true };
    }),

  /**
   * Disconnect an MCP connector by removing OAuth session data only.
   */
  disconnect: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertMcpEnabled();
      await getConnectorWithPermission({
        id: input.id,
        permission: "own-or-global",
        userId: ctx.user.id,
      });
      await deleteSessionsByConnectorId({ mcpConnectorId: input.id });
      await removeMcpClient(input.id);
      invalidateAllMcpCaches(input.id);
      return { success: true };
    }),

  /**
   * Discover tools, resources, and prompts from an MCP server.
   * Cached for 5 minutes.
   */
  discover: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      assertMcpEnabled();
      const connector = await getConnectorWithPermission({
        id: input.id,
        permission: "own-or-global",
        userId: ctx.user.id,
      });

      const fetchDiscovery = async (): Promise<DiscoveryResult> => {
        log.debug(
          { connectorId: connector.id, url: connector.url },
          "creating MCP client for discovery (cache miss)"
        );

        // Use OAuth-aware client
        const mcpClient = getOrCreateMcpClient({
          id: connector.id,
          name: connector.name,
          type: connector.type,
          url: connector.url,
        });

        await mcpClient.connect();

        // Check if authorization is needed
        if (mcpClient.status === "authorizing") {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Connector requires OAuth authorization",
          });
        }

        if (mcpClient.status !== "connected") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to connect to MCP server (status: ${mcpClient.status})`,
          });
        }

        log.debug(
          { connectorId: connector.id },
          "MCP client connected, discovering capabilities"
        );

        try {
          const [toolsResult, resourcesResult, promptsResult] =
            await Promise.all([
              mcpClient
                .tools()
                .then((tools) =>
                  Object.entries(tools).map(([name, tool]) => ({
                    description:
                      typeof tool.description === "string"
                        ? tool.description
                        : null,
                    name,
                  }))
                )
                .catch((error) => {
                  log.warn(
                    { connectorId: connector.id, err: error },
                    "failed to list tools"
                  );
                  return [];
                }),
              mcpClient
                .listResources()
                .then((r) =>
                  r.resources.map((res) => ({
                    description: res.description ?? null,
                    mimeType: res.mimeType ?? null,
                    name: res.name,
                    uri: res.uri,
                  }))
                )
                .catch((error) => {
                  log.warn(
                    { connectorId: connector.id, err: error },
                    "failed to list resources"
                  );
                  return [];
                }),
              mcpClient
                .listPrompts()
                .then((r) =>
                  r.prompts.map((p) => ({
                    arguments:
                      p.arguments?.map((arg) => ({
                        name: arg.name,
                        description: arg.description ?? null,
                        required: arg.required ?? false,
                      })) ?? [],
                    description: p.description ?? null,
                    name: p.name,
                  }))
                )
                .catch((error) => {
                  log.warn(
                    { connectorId: connector.id, err: error },
                    "failed to list prompts"
                  );
                  return [];
                }),
            ]);

          log.info(
            {
              connectorId: connector.id,
              promptsCount: promptsResult.length,
              resourcesCount: resourcesResult.length,
              toolsCount: toolsResult.length,
            },
            "MCP discovery completed"
          );

          return {
            prompts: promptsResult,
            resources: resourcesResult,
            tools: toolsResult,
          };
        } finally {
          // Don't close the client - keep it cached for reuse
          log.debug({ connectorId: connector.id }, "MCP discovery finished");
        }
      };

      const cachedFetch = createCachedDiscovery(connector.id, fetchDiscovery);

      return cachedFetch();
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    if (!config.ai.tools.mcp.enabled) {
      return [];
    }
    return await getMcpConnectorsByUserId({ userId: ctx.user.id });
  }),

  /**
   * List connectors with their connection status.
   * Returns only connectors that have a valid connection (for use in dropdowns, etc.)
   * Still includes enabled/disabled state so UI can show toggles.
   */
  listConnected: protectedProcedure.query(async ({ ctx }) => {
    if (!config.ai.tools.mcp.enabled) {
      return [];
    }
    const connectors = await getMcpConnectorsByUserId({ userId: ctx.user.id });

    const results = await Promise.all(
      connectors.map(async (connector) => {
        const fetchConnectionStatus =
          async (): Promise<ConnectionStatusResult> => {
            const mcpClient = getOrCreateMcpClient({
              id: connector.id,
              name: connector.name,
              type: connector.type,
              url: connector.url,
            });
            const result = await mcpClient.attemptConnection();
            return {
              error: result.error,
              needsAuth: result.needsAuth,
              status: result.status,
            };
          };

        const cachedFetch = createCachedConnectionStatus(
          connector.id,
          fetchConnectionStatus
        );

        try {
          const status = await cachedFetch();
          return { connector, status };
        } catch {
          return { connector, status: null };
        }
      })
    );

    return results
      .filter((r) => r.status?.status === "connected")
      .map((r) => r.connector);
  }),

  /**
   * Refresh/reconnect an MCP client after OAuth completion.
   */
  refreshClient: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertMcpEnabled();
      const connector = await getConnectorWithPermission({
        id: input.id,
        permission: "own-or-global",
        userId: ctx.user.id,
      });

      await removeMcpClient(connector.id);
      invalidateAllMcpCaches(connector.id);

      const mcpClient = getOrCreateMcpClient({
        id: connector.id,
        name: connector.name,
        type: connector.type,
        url: connector.url,
      });

      await mcpClient.connect();

      return {
        needsAuth: mcpClient.status === "authorizing",
        status: mcpClient.status,
      };
    }),

  /**
   * Lightweight connection test - just checks if we can connect without full discovery.
   * Much faster than discover since it doesn't fetch tools/resources/prompts.
   * Cached for 60 seconds.
   */
  testConnection: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      assertMcpEnabled();
      const connector = await getConnectorWithPermission({
        id: input.id,
        permission: "own-or-global",
        userId: ctx.user.id,
      });

      const fetchConnectionStatus =
        async (): Promise<ConnectionStatusResult> => {
          log.debug(
            { connectorId: connector.id, url: connector.url },
            "testing MCP connection (cache miss)"
          );

          const mcpClient = getOrCreateMcpClient({
            id: connector.id,
            name: connector.name,
            type: connector.type,
            url: connector.url,
          });

          const result = await mcpClient.attemptConnection();

          log.debug(
            {
              connectorId: connector.id,
              error: result.error,
              needsAuth: result.needsAuth,
              status: result.status,
            },
            "MCP connection test completed"
          );

          return {
            error: result.error,
            needsAuth: result.needsAuth,
            status: result.status,
          };
        };

      const cachedFetch = createCachedConnectionStatus(
        connector.id,
        fetchConnectionStatus
      );

      return cachedFetch();
    }),

  toggleEnabled: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMcpEnabled();
      await getConnectorWithPermission({
        id: input.id,
        permission: "own",
        userId: ctx.user.id,
      });
      await updateMcpConnector({
        id: input.id,
        updates: { enabled: input.enabled },
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        updates: z.object({
          enabled: z.boolean().optional(),
          name: z.string().min(1).max(MCP_NAME_MAX_LENGTH).optional(),
          oauthClientId: z.string().nullable().optional(),
          oauthClientSecret: z.string().nullable().optional(),
          type: z.enum(["http", "sse"]).optional(),
          url: z.string().url().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMcpEnabled();
      const connector = await getConnectorWithPermission({
        id: input.id,
        permission: "own",
        userId: ctx.user.id,
      });

      const updates = { ...input.updates };
      if (updates.name) {
        const nameId = await validateAndGenerateNameId({
          excludeId: input.id,
          name: updates.name,
          userId: connector.userId,
        });
        (updates as typeof updates & { nameId: string }).nameId = nameId;
      }

      await updateMcpConnector({ id: input.id, updates });
      return { success: true };
    }),
});
