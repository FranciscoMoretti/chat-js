import {
  auth,
  experimental_createMCPClient as createMCPClient,
} from "@ai-sdk/mcp";
import type {
  ListPromptsResult,
  ListResourcesResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { Tool, ToolSet } from "ai";

import { config } from "@/lib/config";
import { createModuleLogger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/url";

import { invalidateAllMcpCaches } from "./cache";
import {
  McpOAuthClientProvider,
  OAuthAuthorizationRequiredError,
} from "./mcp-oauth-provider";

const log = createModuleLogger("mcp-client");

type McpClientInstance = Awaited<ReturnType<typeof createMCPClient>>;

type McpClientStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "authorizing"
  | "incompatible";

/**
 * MCP Client wrapper with OAuth support.
 * Uses @ai-sdk/mcp's createMCPClient with authProvider for OAuth flow.
 */
export class MCPClient {
  private client?: McpClientInstance;
  private readonly oauthProvider: McpOAuthClientProvider;
  private authorizationUrl?: URL;
  private _status: McpClientStatus = "disconnected";

  private readonly id: string;
  private readonly name: string;
  private readonly serverConfig: {
    url: string;
    type: "http" | "sse";
    headers?: Record<string, string>;
  };

  constructor(
    id: string,
    name: string,
    serverConfig: {
      url: string;
      type: "http" | "sse";
      headers?: Record<string, string>;
    }
  ) {
    this.id = id;
    this.name = name;
    this.serverConfig = serverConfig;
    const baseUrl = getBaseUrl();

    this.oauthProvider = new McpOAuthClientProvider({
      clientMetadata: {
        client_name: `${config.appPrefix}-${this.name}`,
        grant_types: ["authorization_code", "refresh_token"],
        redirect_uris: [`${baseUrl}/api/mcp/oauth/callback`],
        response_types: ["code"],
        scope: "mcp:tools",
        software_id: config.appPrefix,
        software_version: "1.0.0",
        // PKCE
        token_endpoint_auth_method: "none",
      },
      mcpConnectorId: this.id,
      onRedirectToAuthorization: (authorizationUrl: URL) => {
        this.authorizationUrl = authorizationUrl;
        throw new OAuthAuthorizationRequiredError(authorizationUrl);
      },
      serverUrl: this.serverConfig.url,
    });
  }

  get status(): McpClientStatus {
    if (this.authorizationUrl) {
      return "authorizing";
    }
    if (this.client) {
      return "connected";
    }
    return this._status;
  }

  getAuthorizationUrl(): URL | undefined {
    return this.authorizationUrl;
  }

  get serverInfo() {
    return this.client?.serverInfo;
  }

  async connect(oauthState?: string): Promise<McpClientInstance | undefined> {
    if (this.status === "connected" && this.client) {
      return this.client;
    }

    this._status = "connecting";

    // Adopt state if provided (for callback reconciliation)
    if (oauthState) {
      await this.oauthProvider.adoptState(oauthState);
    }

    try {
      // AI SDK handles 401 internally and calls auth() with the provider
      this.client = await createMCPClient({
        transport: {
          authProvider: this.oauthProvider,
          headers: this.serverConfig.headers,
          type: this.serverConfig.type,
          url: this.serverConfig.url,
        },
      });

      this._status = "connected";
      return this.client;
    } catch (error) {
      // If OAuth required error, status becomes "authorizing"
      if (error instanceof OAuthAuthorizationRequiredError) {
        this._status = "authorizing";
        log.info(
          { authUrl: error.authorizationUrl.toString(), connectorId: this.id },
          "OAuth authorization required"
        );
        return;
      }

      this._status = "disconnected";
      throw error;
    }
  }

  /**
   * Lightweight connection test - just checks if we can connect without full discovery.
   * Returns connection status without fetching tools/resources/prompts.
   */
  async attemptConnection(): Promise<{
    status: McpClientStatus;
    needsAuth: boolean;
    error?: string;
  }> {
    // If already connected, return current status
    if (this.status === "connected" && this.client) {
      return { needsAuth: false, status: "connected" };
    }

    // If already in authorizing state, return that
    if (this.authorizationUrl) {
      return { needsAuth: true, status: "authorizing" };
    }

    try {
      await this.connect();
      // Check if OAuth is required (authorizationUrl gets set during connect)
      if (this.authorizationUrl) {
        return { needsAuth: true, status: "authorizing" };
      }
      return {
        needsAuth: false,
        status: this.client ? "connected" : "disconnected",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error(
        {
          connectorId: this.id,
          errorMessage,
          errorStack: error instanceof Error ? error.stack : undefined,
        },
        "attemptConnection failed"
      );

      // Detect incompatible server errors
      if (
        errorMessage.includes("does not support dynamic client registration")
      ) {
        this._status = "incompatible";
        return {
          error:
            "Server requires pre-configured OAuth credentials (does not support dynamic client registration)",
          needsAuth: false,
          status: "incompatible",
        };
      }

      return { error: errorMessage, needsAuth: false, status: "disconnected" };
    }
  }

  /**
   * Called after callback receives code to complete the OAuth flow.
   */
  async finishAuth(code: string, state: string): Promise<void> {
    // Always adopt the state from the callback to load the session with code verifier
    await this.oauthProvider.adoptState(state);

    // Use the auth function from @ai-sdk/mcp to complete the OAuth flow
    await auth(this.oauthProvider, {
      authorizationCode: code,
      serverUrl: this.serverConfig.url,
    });

    this.authorizationUrl = undefined;
    // Don't set to connected - tokens are saved, next connect() will use them
  }

  /**
   * Get tools from the MCP server, already in AI SDK format.
   */
  async tools(
    ...args: Parameters<NonNullable<McpClientInstance>["tools"]>
  ): Promise<Record<string, Tool>> {
    if (!this.client) {
      throw new Error("Client not connected");
    }
    try {
      return (await this.client.tools(...args)) as ToolSet as Record<
        string,
        Tool
      >;
    } catch (error) {
      this.handlePotentialAuthError(error);
      throw error;
    }
  }

  /**
   * List resources from the MCP server.
   */
  async listResources(): Promise<ListResourcesResult> {
    if (!this.client) {
      throw new Error("Client not connected");
    }
    try {
      return await this.client.listResources();
    } catch (error) {
      this.handlePotentialAuthError(error);
      throw error;
    }
  }

  /**
   * List prompts from the MCP server.
   */
  async listPrompts(): Promise<ListPromptsResult> {
    if (!this.client) {
      throw new Error("Client not connected");
    }
    try {
      return await this.client.experimental_listPrompts();
    } catch (error) {
      this.handlePotentialAuthError(error);
      throw error;
    }
  }

  /**
   * Close the connection to the MCP server.
   */
  async close(): Promise<void> {
    try {
      await this.client?.close();
    } catch (error) {
      log.error({ connectorId: this.id, error }, "Error closing MCP client");
    }
    this.client = undefined;
    this._status = "disconnected";
    // Invalidate caches since connection state changed
    invalidateAllMcpCaches(this.id);
  }

  /**
   * Check if an error is an auth error (401/403) and invalidate caches if so.
   */
  private handlePotentialAuthError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isAuthError =
      errorMessage.includes("401") ||
      errorMessage.includes("403") ||
      errorMessage.includes("Unauthorized") ||
      errorMessage.includes("Forbidden") ||
      errorMessage.includes("token");

    if (isAuthError) {
      log.warn(
        { connectorId: this.id, errorMessage },
        "Auth error detected, invalidating caches"
      );
      invalidateAllMcpCaches(this.id);
    }
  }
}

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
    client = new MCPClient(id, name, { headers, type, url });
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
    await client.close();
    clientsMap.delete(id);
  }
};

/**
 * Get an existing MCP client by ID.
 */
const _getMcpClient = (id: string): MCPClient | undefined => clientsMap.get(id);

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
}): MCPClient => new MCPClient(id, name, { headers, type, url });
