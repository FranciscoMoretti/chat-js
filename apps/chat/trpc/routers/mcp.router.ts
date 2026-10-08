import type {
  ConnectionStatusResult,
  DiscoveryResult,
} from "@/lib/ai/mcp/cache";
import { MCP_NAME_MAX_LENGTH, generateMcpNameId } from "@/lib/ai/mcp-name-id";
import { MissingCredentialsError } from "@/lib/required-credentials";
import { TRPCError } from "@trpc/server";
import { assertUrlIsSafeToFetch } from "guarded-fetch";
import { z } from "zod";
/* oxlint-disable sort-imports -- Keep preceding package initialization before environment validation reached through MCP setup; sorting would change which runtime graph completes before validation can throw. */
import { requireMcpCredentials } from "@/features/mcp/setup";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep MCP setup environment validation before Next cache branch selection and cache logger initialization; their runtime graphs have not been proved to commute. */
import {
  createCachedConnectionStatus,
  createCachedDiscovery,
  invalidateAllMcpCaches,
} from "@/lib/ai/mcp/cache";
/* oxlint-enable sort-imports */
import {
  getOrCreateMcpClient,
  removeMcpClient,
} from "@/lib/ai/mcp/mcp-client-manager";
import { createModuleLogger } from "@/lib/logger";
import { installedFeatures } from "@/features/installed";
/* oxlint-disable sort-imports -- Keep MCP client/provider lock-pool initialization before a direct MCP database-query edge; moving that edge earlier changes the first-evaluation trace of lock, database and logger modules. */
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting imports would hide the dependency boundary without reducing dependencies. */
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
/* oxlint-enable import/max-dependencies */
/* oxlint-enable sort-imports */
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

// Procedure callbacks read only the authenticated user identity from tRPC context.
type McpProcedureContext = Readonly<{ user: Readonly<{ id: string }> }>;

type McpConnectorReader = Readonly<
  PublicConnectorInput &
    Pick<McpConnectorRow, "oauthClientId" | "oauthClientSecret">
>;
type McpConnectionResultReader = Readonly<{
  connector: McpConnectorReader;
  status: Readonly<ConnectionStatusResult> | null;
}>;

type McpResourceReader = Readonly<{
  description?: string;
  mimeType?: string;
  name: string;
  uri: string;
}>;
type McpPromptArgumentReader = Readonly<{
  description?: string;
  name: string;
  required?: boolean;
}>;
type McpPromptReader = Readonly<{
  arguments?: readonly McpPromptArgumentReader[];
  description?: string;
  name: string;
}>;

const log = createModuleLogger("mcp.router");

const assertMcpReady = (): void => {
  if (!installedFeatures.has("mcp")) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "MCP is not installed",
    });
  }
  try {
    requireMcpCredentials();
  } catch (error) {
    if (error instanceof MissingCredentialsError) {
      throw new TRPCError({
        cause: error,
        code: "PRECONDITION_FAILED",
        message: error.message,
      });
    }
    throw error;
  }
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve validateAndGenerateNameId's awaited sequencing and rejected-Promise behavior. */
/**
 * Validates and generates a nameId from a connector name.
 * Throws TRPCError if the name is invalid or the namespace already exists.
 * @param {Readonly<{ name: string; userId: string | null; excludeId?: string; }>} options - Candidate name, namespace owner, and connector excluded during rename.
 * @returns {Promise<string>} The validated available connector namespace.
 */
const validateAndGenerateNameId = async ({
  name,
  userId,
  excludeId,
}: {
  readonly name: string;
  readonly userId: string | null;
  readonly excludeId?: string;
}): Promise<string> => {
  assertMcpReady();
  const result = generateMcpNameId(name);
  if (!result.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        // oxlint-disable-next-line no-ternary -- Keep message as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
};
/* oxlint-enable oxc/no-async-await */

type Permission = "own" | "own-or-global";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getConnectorWithPermission's awaited sequencing and rejected-Promise behavior. */
/**
 * Fetches connector and validates user permission.
 * - "own": user must own the connector (userId === ctx.user.id)
 * - "own-or-global": user must own OR connector is global (userId === null)
 * @param {Readonly<{ id: string; userId: string; permission: Permission; }>} options - Connector identity and required ownership permission.
 * @returns {Promise<McpConnectorRow>} The connector after permission validation.
 */
const getConnectorWithPermission = async ({
  id,
  userId,
  permission,
}: {
  readonly id: string;
  readonly userId: string;
  readonly permission: Permission;
}): Promise<McpConnectorRow> => {
  const connector = await getMcpConnectorById({ id });
  if (!connector) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
  }

  const isOwner = connector.userId === userId;
  const isGlobal = connector.userId === null;

  // oxlint-disable-next-line no-ternary -- Keep hasPermission as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const hasPermission = permission === "own" ? isOwner : isOwner || isGlobal;

  if (!hasPermission) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot access this connector",
    });
  }

  return connector;
};
/* oxlint-enable oxc/no-async-await */

const displayConnectorUrl = (value: string): string => {
  const url = new URL(value);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.href;
};

type McpConnectorRow = NonNullable<
  Awaited<ReturnType<typeof getMcpConnectorById>>
>;
type PublicConnectorInput = Readonly<
  Pick<
    McpConnectorRow,
    | "enabled"
    | "id"
    | "name"
    | "nameId"
    | "requireApproval"
    | "type"
    | "url"
    | "userId"
  > & {
    createdAt: Readonly<McpConnectorRow["createdAt"]>;
    updatedAt: Readonly<McpConnectorRow["updatedAt"]>;
  }
>;

type PublicConnector = {
  -readonly [
    Property in keyof PublicConnectorInput
  ]: PublicConnectorInput[Property];
} & {
  oauthClientId: null;
  oauthClientSecret: null;
};

/* oxlint-disable unicorn/no-null -- Connector responses explicitly redact both OAuth credential fields with null. */
const publicConnector = (connector: PublicConnectorInput): PublicConnector => ({
  createdAt: connector.createdAt,
  enabled: connector.enabled,
  id: connector.id,
  name: connector.name,
  nameId: connector.nameId,
  oauthClientId: null,
  oauthClientSecret: null,
  requireApproval: connector.requireApproval,
  type: connector.type,
  updatedAt: connector.updatedAt,
  url: displayConnectorUrl(connector.url),
  userId: connector.userId,
});
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (mcpRouter); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve mcpRouter's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */

/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
export const mcpRouter = createTRPCRouter({
  /**
   * Initiate OAuth authorization for an MCP connector.
   * Returns the authorization URL that the client should open in a popup.
   */
  authorize: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(
    async ({
      ctx,
      input,
    }: Readonly<{
      ctx: McpProcedureContext;
      input: Readonly<{ id: string }>;
    }>) => {
      assertMcpReady();
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
        oauthClientId: connector.oauthClientId,
        oauthClientSecret: connector.oauthClientSecret,
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

      if (authUrl.protocol !== "http:" && authUrl.protocol !== "https:") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid authorization URL",
        });
      }
      log.info(
        { authUrl: authUrl.toString(), connectorId: connector.id },
        "OAuth authorization URL generated"
      );

      await assertUrlIsSafeToFetch(authUrl.toString(), {
        opaqueErrors: true,
      });
      return { authorizationUrl: authUrl.toString() };
    }
  ),

  /**
   * Check if a connector has valid OAuth tokens.
   */
  checkAuth: protectedProcedure.input(z.object({ id: z.uuid() })).query(
    async ({
      ctx,
      input,
    }: Readonly<{
      ctx: McpProcedureContext;
      input: Readonly<{ id: string }>;
    }>) => {
      assertMcpReady();
      const connector = await getConnectorWithPermission({
        id: input.id,
        permission: "own-or-global",
        userId: ctx.user.id,
      });

      const session = await getAuthenticatedSession({
        mcpConnectorId: connector.id,
      });

      return {
        hasSession: Boolean(session),
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading tokens from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
        isAuthenticated: Boolean(session?.tokens),
      };
    }
  ),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(MCP_NAME_MAX_LENGTH),
        oauthClientId: z.string().optional(),
        oauthClientSecret: z.string().optional(),
        type: z.enum(["http", "sse"]),
        url: z.url(),
      })
    )
    .mutation(
      async ({
        ctx,
        input,
      }: Readonly<{
        ctx: McpProcedureContext;
        input: Readonly<{
          name: string;
          type: "http" | "sse";
          url: string;
          oauthClientId?: string | undefined;
          oauthClientSecret?: string | undefined;
        }>;
      }>) => {
        assertMcpReady();
        await assertUrlIsSafeToFetch(input.url, { opaqueErrors: true });
        const nameId = await validateAndGenerateNameId({
          name: input.name,
          userId: ctx.user.id,
        });

        return publicConnector(
          await createMcpConnector({
            name: input.name,
            nameId,
            oauthClientId: input.oauthClientId,
            oauthClientSecret: input.oauthClientSecret,
            type: input.type,
            url: input.url,
            userId: ctx.user.id,
          })
        );
      }
    ),

  delete: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(
    async ({
      ctx,
      input,
    }: Readonly<{
      ctx: McpProcedureContext;
      input: Readonly<{ id: string }>;
    }>) => {
      assertMcpReady();
      await getConnectorWithPermission({
        id: input.id,
        permission: "own",
        userId: ctx.user.id,
      });
      await deleteMcpConnector({ id: input.id });
      await removeMcpClient(input.id);
      return { success: true };
    }
  ),

  /**
   * Disconnect an MCP connector by removing OAuth session data only.
   */
  disconnect: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(
    async ({
      ctx,
      input,
    }: Readonly<{
      ctx: McpProcedureContext;
      input: Readonly<{ id: string }>;
    }>) => {
      assertMcpReady();
      await getConnectorWithPermission({
        id: input.id,
        permission: "own-or-global",
        userId: ctx.user.id,
      });
      await deleteSessionsByConnectorId({ mcpConnectorId: input.id });
      await removeMcpClient(input.id);
      invalidateAllMcpCaches(input.id);
      return { success: true };
    }
  ),

  /**
   * Discover tools, resources, and prompts from an MCP server.
   * Cached for 5 minutes.
   */
  discover: protectedProcedure.input(z.object({ id: z.uuid() })).query(
    async ({
      ctx,
      input,
    }: Readonly<{
      ctx: McpProcedureContext;
      input: Readonly<{ id: string }>;
    }>) => {
      assertMcpReady();
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
          oauthClientId: connector.oauthClientId,
          oauthClientSecret: connector.oauthClientSecret,
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
                .then(
                  (
                    tools: Readonly<
                      Record<string, Readonly<{ description?: unknown }>>
                    >
                  ) =>
                    Object.entries(tools).map(
                      ([name, tool]: readonly [
                        string,
                        Readonly<{ description?: unknown }>,
                      ]) => ({
                        description:
                          // oxlint-disable-next-line no-ternary -- Keep description as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                          typeof tool.description === "string"
                            ? tool.description
                            : null,
                        name,
                      })
                    )
                )
                .catch((error: unknown) => {
                  log.warn(
                    { connectorId: connector.id, err: error },
                    "failed to list tools"
                  );
                  return [];
                }),
              mcpClient
                .listResources()
                .then(
                  (
                    resourceResult: Readonly<{
                      resources: readonly McpResourceReader[];
                    }>
                  ) =>
                    resourceResult.resources.map((res: McpResourceReader) => ({
                      description: res.description ?? null,
                      mimeType: res.mimeType ?? null,
                      name: res.name,
                      uri: res.uri,
                    }))
                )
                .catch((error: unknown) => {
                  log.warn(
                    { connectorId: connector.id, err: error },
                    "failed to list resources"
                  );
                  return [];
                }),
              mcpClient
                .listPrompts()
                .then(
                  (
                    promptResult: Readonly<{
                      prompts: readonly McpPromptReader[];
                    }>
                  ) =>
                    promptResult.prompts.map((prompt: McpPromptReader) => ({
                      arguments:
                        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading map from prompt.arguments; preserve one receiver evaluation, skipped accesses and the existing [] fallback.
                        prompt.arguments?.map(
                          (arg: McpPromptArgumentReader) => ({
                            description: arg.description ?? null,
                            name: arg.name,
                            required: arg.required ?? false,
                          })
                        ) ?? [],
                      description: prompt.description ?? null,
                      name: prompt.name,
                    }))
                )
                .catch((error: unknown) => {
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

      return await cachedFetch();
    }
  ),

  list: protectedProcedure.query(
    async ({
      ctx,
    }: Readonly<{ ctx: McpProcedureContext; input: undefined }>) => {
      assertMcpReady();
      const connectors = await getMcpConnectorsByUserId({
        userId: ctx.user.id,
      });
      return connectors.map((connector: PublicConnectorInput) =>
        publicConnector(connector)
      );
    }
  ),

  /**
   * List connectors with their connection status.
   * Returns only connectors that have a valid connection (for use in dropdowns, etc.)
   * Still includes enabled/disabled state so UI can show toggles.
   */
  listConnected: protectedProcedure.query(
    async ({
      ctx,
    }: Readonly<{ ctx: McpProcedureContext; input: undefined }>) => {
      assertMcpReady();
      const connectors = await getMcpConnectorsByUserId({
        userId: ctx.user.id,
      });

      const results = await Promise.all(
        connectors.map(async (connector: McpConnectorReader) => {
          const fetchConnectionStatus =
            async (): Promise<ConnectionStatusResult> => {
              const mcpClient = getOrCreateMcpClient({
                id: connector.id,
                name: connector.name,
                oauthClientId: connector.oauthClientId,
                oauthClientSecret: connector.oauthClientSecret,
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
        .filter(
          (connectionResult: McpConnectionResultReader): boolean =>
            // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading status from connectionResult.status; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
            connectionResult.status?.status === "connected"
        )
        .map((connectionResult: McpConnectionResultReader) =>
          publicConnector(connectionResult.connector)
        );
    }
  ),

  /**
   * Refresh/reconnect an MCP client after OAuth completion.
   */
  refreshClient: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(
    async ({
      ctx,
      input,
    }: Readonly<{
      ctx: McpProcedureContext;
      input: Readonly<{ id: string }>;
    }>) => {
      assertMcpReady();
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
        oauthClientId: connector.oauthClientId,
        oauthClientSecret: connector.oauthClientSecret,
        type: connector.type,
        url: connector.url,
      });

      await mcpClient.connect();

      return {
        needsAuth: mcpClient.status === "authorizing",
        status: mcpClient.status,
      };
    }
  ),

  /**
   * Lightweight connection test - just checks if we can connect without full discovery.
   * Much faster than discover since it doesn't fetch tools/resources/prompts.
   * Cached for 60 seconds.
   */
  testConnection: protectedProcedure.input(z.object({ id: z.uuid() })).query(
    async ({
      ctx,
      input,
    }: Readonly<{
      ctx: McpProcedureContext;
      input: Readonly<{ id: string }>;
    }>) => {
      assertMcpReady();
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
            oauthClientId: connector.oauthClientId,
            oauthClientSecret: connector.oauthClientSecret,
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

      return await cachedFetch();
    }
  ),

  toggleEnabled: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        id: z.uuid(),
      })
    )
    .mutation(
      async ({
        ctx,
        input,
      }: Readonly<{
        ctx: McpProcedureContext;
        input: Readonly<{ enabled: boolean; id: string }>;
      }>) => {
        assertMcpReady();
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
      }
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        updates: z.object({
          enabled: z.boolean().optional(),
          name: z.string().min(1).max(MCP_NAME_MAX_LENGTH).optional(),
          oauthClientId: z.string().nullable().optional(),
          oauthClientSecret: z.string().nullable().optional(),
          requireApproval: z.boolean().optional(),
          type: z.enum(["http", "sse"]).optional(),
          url: z.url().optional(),
        }),
      })
    )
    .mutation(
      async ({
        ctx,
        input,
      }: Readonly<{
        ctx: McpProcedureContext;
        input: Readonly<{
          id: string;
          updates: Readonly<{
            enabled?: boolean | undefined;
            name?: string | undefined;
            oauthClientId?: string | null | undefined;
            oauthClientSecret?: string | null | undefined;
            requireApproval?: boolean | undefined;
            type?: "http" | "sse" | undefined;
            url?: string | undefined;
          }>;
        }>;
      }>) => {
        assertMcpReady();
        const connector = await getConnectorWithPermission({
          id: input.id,
          permission: "own",
          userId: ctx.user.id,
        });

        const updates: typeof input.updates & { nameId?: string } = {
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the fresh shallow copy of input.updates rather than sharing its source identity; pinned eslint/prefer-object-spread rejects Object.assign.
          ...input.updates,
        };
        if (typeof updates.url === "string" && updates.url !== "") {
          await assertUrlIsSafeToFetch(updates.url, { opaqueErrors: true });
        }
        if (typeof updates.name === "string" && updates.name !== "") {
          const nameId = await validateAndGenerateNameId({
            excludeId: input.id,
            name: updates.name,
            userId: connector.userId,
          });
          updates.nameId = nameId;
        }

        await updateMcpConnector({ id: input.id, updates });
        if (
          (updates.url !== undefined && updates.url !== connector.url) ||
          (updates.type !== undefined && updates.type !== connector.type) ||
          (updates.oauthClientId !== undefined &&
            updates.oauthClientId !== connector.oauthClientId) ||
          (updates.oauthClientSecret !== undefined &&
            updates.oauthClientSecret !== connector.oauthClientSecret)
        ) {
          await deleteSessionsByConnectorId({ mcpConnectorId: input.id });
        }
        await removeMcpClient(input.id);
        invalidateAllMcpCaches(input.id);
        return { success: true };
      }
    ),
});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/no-undefined */

/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
