import type {
  ListPromptsResult,
  ListResourcesResult,
} from "@modelcontextprotocol/sdk/types.js";
import {
  auth,
  experimental_createMCPClient as createMCPClient,
} from "@ai-sdk/mcp";
import { McpOAuthClientProvider } from "@/lib/ai/mcp/mcp-oauth-provider";
import { OAuthAuthorizationRequiredError } from "@/lib/ai/mcp/oauth-authorization-required-error";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { Tool } from "ai";
import { config } from "@/lib/config";
import { createModuleLogger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/url";

const log = createModuleLogger("mcp-client");

const INITIAL_CONNECTION_GENERATION = 0;
const MCP_CONNECTION_TIMEOUT_MS = 30_000;

const getMcpErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

type McpPreconnect = (
  url: string | URL,
  options?: {
    readonly dns?: boolean;
    readonly http?: boolean;
    readonly https?: boolean;
    readonly tcp?: boolean;
  }
) => void;

const isMcpPreconnect = (value: unknown): value is McpPreconnect =>
  typeof value === "function";

// Bun's fetch type requires preconnect. Node's does not. Delegate when the
// runtime provides it so one fetch value satisfies both FetchFunction types.
const mcpPreconnect: McpPreconnect = (url, options): void => {
  const candidate: object = globalThis.fetch;
  if (!("preconnect" in candidate)) {
    return;
  }
  const method: unknown = candidate.preconnect;
  if (!isMcpPreconnect(method)) {
    return;
  }
  method(url, options);
};

const toMcpSdkFetch = (
  fetchImpl: (
    ...args: Parameters<typeof globalThis.fetch>
  ) => ReturnType<typeof globalThis.fetch>
): typeof globalThis.fetch =>
  Object.assign(fetchImpl, { preconnect: mcpPreconnect });

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
  private generation = INITIAL_CONNECTION_GENERATION;
  private connectionAbort?: AbortController;
  private connectPromise?: Promise<McpClientInstance | undefined>;
  private readonly invalidateCache?: () => void;
  private oauthProvider: McpOAuthClientProvider;
  private authorizationUrl?: URL;
  private connectionStatus: McpClientStatus = "disconnected";

  private readonly id: string;
  private readonly name: string;
  private readonly serverConfig: {
    url: string;
    type: "http" | "sse";
    headers?: Record<string, string>;
    oauthClientId?: string | null;
    oauthClientSecret?: string | null;
  };

  public constructor(
    id: string,
    name: string,
    serverConfig: {
      readonly url: string;
      readonly type: "http" | "sse";
      readonly headers?: Readonly<Record<string, string>>;
      readonly oauthClientId?: string | null;
      readonly oauthClientSecret?: string | null;
    },
    invalidateCache?: () => void
  ) {
    this.invalidateCache = invalidateCache;
    this.id = id;
    this.name = name;
    this.serverConfig = serverConfig;
    this.oauthProvider = this.createOAuthProvider();
  }

  private createOAuthProvider(): McpOAuthClientProvider {
    const { generation } = this;
    const baseUrl = getBaseUrl();

    return new McpOAuthClientProvider({
      clientMetadata: {
        client_name: `${config.appPrefix}-${this.name}`,
        grant_types: ["authorization_code", "refresh_token"],
        redirect_uris: [`${baseUrl}/api/mcp/oauth/callback`],
        response_types: ["code"],
        scope: "mcp:tools",
        software_id: config.appPrefix,
        software_version: "1.0.0",
        token_endpoint_auth_method:
          typeof this.serverConfig.oauthClientId === "string" &&
          this.serverConfig.oauthClientId !== "" &&
          typeof this.serverConfig.oauthClientSecret === "string" &&
          this.serverConfig.oauthClientSecret !== ""
            ? "client_secret_basic"
            : "none",
      },
      mcpConnectorId: this.id,
      oauthClientId: this.serverConfig.oauthClientId,
      oauthClientSecret: this.serverConfig.oauthClientSecret,
      onRedirectToAuthorization: (
        authorizationUrl: ReadonlyNativeSurface<URL>
      ): never => {
        if (generation !== this.generation) {
          throw new Error("MCP connection was closed");
        }
        this.authorizationUrl = authorizationUrl;
        throw new OAuthAuthorizationRequiredError(authorizationUrl);
      },
      serverUrl: this.serverConfig.url,
    });
  }

  public get status(): McpClientStatus {
    if (this.authorizationUrl) {
      return "authorizing";
    }
    if (this.client) {
      return "connected";
    }
    return this.connectionStatus;
  }

  public getAuthorizationUrl(): URL | undefined {
    return this.authorizationUrl;
  }

  public get serverInfo(): McpClientInstance["serverInfo"] | undefined {
    const { client } = this;
    return client && client.serverInfo;
  }

  public async connect(
    oauthState?: string,
    abortSignal?: Readonly<
      Pick<
        AbortSignal,
        | "throwIfAborted"
        | "reason"
        | "addEventListener"
        | "removeEventListener"
        | "aborted"
      >
    >
  ): Promise<McpClientInstance | undefined> {
    if (abortSignal) {
      abortSignal.throwIfAborted();
    }
    if (!this.connectPromise) {
      const { generation } = this;
      this.connectPromise = (async (): Promise<
        McpClientInstance | undefined
      > => {
        try {
          return await this.connectOnce(oauthState);
        } finally {
          // Only close() can retire a pending attempt and allow a replacement.
          if (this.generation === generation) {
            this.connectPromise = undefined;
          }
        }
      })();
    }
    if (!abortSignal) {
      return await this.connectPromise;
    }
    const aborted = Promise.withResolvers<never>();
    const cancel = (): void => {
      aborted.reject(abortSignal.reason);
    };
    abortSignal.addEventListener("abort", cancel, { once: true });
    if (abortSignal.aborted) {
      cancel();
    }
    try {
      return await Promise.race([this.connectPromise, aborted.promise]);
    } finally {
      abortSignal.removeEventListener("abort", cancel);
    }
  }
  private async connectOnce(
    oauthState?: string
  ): Promise<McpClientInstance | undefined> {
    if (this.status === "connected" && this.client) {
      return this.client;
    }

    const { generation, oauthProvider } = this;
    this.connectionAbort = new AbortController();
    const signal = AbortSignal.any([
      this.connectionAbort.signal,
      AbortSignal.timeout(MCP_CONNECTION_TIMEOUT_MS),
    ]);
    this.connectionStatus = "connecting";

    try {
      // Adopt state if provided (for callback reconciliation).
      if (typeof oauthState === "string" && oauthState !== "") {
        await oauthProvider.adoptState(oauthState);
      }
      signal.throwIfAborted();
      // AI SDK handles 401 internally and calls auth() with the provider
      const client = await createMCPClient({
        initializationOptions: { signal },
        transport: {
          authProvider: oauthProvider,
          fetch: toMcpSdkFetch(oauthProvider.fetch),
          headers: this.serverConfig.headers,
          type: this.serverConfig.type,
          url: this.serverConfig.url,
        },
      });

      if (generation !== this.generation || signal.aborted) {
        await client.close();
        signal.throwIfAborted();
        throw new Error("MCP connection was closed");
      }
      this.client = client;
      this.authorizationUrl = undefined;
      this.connectionStatus = "connected";
      return this.client;
    } catch (error) {
      if (generation !== this.generation || signal.aborted) {
        if (generation === this.generation) {
          this.authorizationUrl = undefined;
          this.connectionStatus = "disconnected";
        }
        throw error;
      }
      // If OAuth required error, status becomes "authorizing"
      if (error instanceof OAuthAuthorizationRequiredError) {
        this.connectionStatus = "authorizing";
        log.info(
          { authUrl: error.authorizationUrl.toString(), connectorId: this.id },
          "OAuth authorization required"
        );
        return undefined;
      }

      this.connectionStatus = "disconnected";
      throw error;
    }
  }
  /**
   * Lightweight connection test - just checks if we can connect without full discovery.
   * Returns connection status without fetching tools/resources/prompts.
   * @param {Readonly<Pick<AbortSignal, "throwIfAborted" | "reason" | "addEventListener" | "removeEventListener" | "aborted">> | undefined} abortSignal - Cancels this caller while shared initialization continues.
   * @returns {Promise<{ status: McpClientStatus; needsAuth: boolean; error?: string; }>} The connection or authorization status.
   */
  public async attemptConnection(
    abortSignal?: Readonly<
      Pick<
        AbortSignal,
        | "throwIfAborted"
        | "reason"
        | "addEventListener"
        | "removeEventListener"
        | "aborted"
      >
    >
  ): Promise<{
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
      await this.connect(undefined, abortSignal);
      // Check if OAuth is required (authorizationUrl gets set during connect)
      if (this.authorizationUrl !== undefined) {
        return { needsAuth: true, status: "authorizing" };
      }
      return {
        needsAuth: false,
        status: this.client ? "connected" : "disconnected",
      };
    } catch (error) {
      const errorMessage = getMcpErrorMessage(error);
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
        this.connectionStatus = "incompatible";
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
   * @param {string} code - Authorization code received by the callback.
   * @param {string} state - State used to restore the verifier session.
   */
  public async finishAuth(code: string, state: string): Promise<void> {
    const { generation, oauthProvider } = this;
    // Always adopt the state from the callback to load the session with code verifier
    await oauthProvider.adoptState(state);

    // Use the auth function from @ai-sdk/mcp to complete the OAuth flow
    await auth(oauthProvider, {
      authorizationCode: code,
      fetchFn: toMcpSdkFetch(oauthProvider.fetch),
      serverUrl: this.serverConfig.url,
    });

    if (generation !== this.generation) {
      throw new Error("MCP connection was closed");
    }
    this.authorizationUrl = undefined;
    // Don't set to connected - tokens are saved, next connect() will use them
  }
  /**
   * Get tools from the MCP server, already in AI SDK format.
   * @param {Parameters<McpClientInstance["tools"]>} args - Native SDK schema options.
   * @returns {Promise<Record<string, Tool>>} The discovered SDK tools.
   */
  public async tools(
    ...args: Parameters<NonNullable<McpClientInstance>["tools"]>
  ): Promise<Record<string, Tool>> {
    const { client } = this;
    if (!client) {
      throw new Error("Client not connected");
    }
    try {
      return await client.tools(...args);
    } catch (error) {
      await this.handlePotentialAuthError(error, client);
      throw error;
    }
  }
  /**
   * List resources from the MCP server.
   * @returns {Promise<ListResourcesResult>} The native MCP resource result.
   */
  public async listResources(): Promise<ListResourcesResult> {
    const { client } = this;
    if (!client) {
      throw new Error("Client not connected");
    }
    try {
      return await client.listResources();
    } catch (error) {
      await this.handlePotentialAuthError(error, client);
      throw error;
    }
  }
  /**
   * List prompts from the MCP server.
   * @returns {Promise<ListPromptsResult>} The native MCP prompt result.
   */
  public async listPrompts(): Promise<ListPromptsResult> {
    const { client } = this;
    if (!client) {
      throw new Error("Client not connected");
    }
    try {
      return await client.experimental_listPrompts();
    } catch (error) {
      await this.handlePotentialAuthError(error, client);
      throw error;
    }
  }
  /**
   * Close the connection to the MCP server.
   */
  public async close(): Promise<void> {
    this.generation += 1;
    const { connectionAbort } = this;
    if (connectionAbort) {
      connectionAbort.abort(new Error("MCP connection was closed"));
    }
    this.connectPromise = undefined;
    this.oauthProvider = this.createOAuthProvider();
    const { client } = this;
    this.client = undefined;
    this.authorizationUrl = undefined;
    this.connectionStatus = "disconnected";
    try {
      // Await even without a client to preserve cache-invalidation timing.
      await (client && client.close());
    } catch (error) {
      log.error({ connectorId: this.id, error }, "Error closing MCP client");
    }
    if (this.invalidateCache) {
      this.invalidateCache();
    }
  }
  /**
   * Check if an error is an auth error (401/403) and invalidate caches if so.
   * @param {unknown} error - Failure from a connected SDK operation.
   * @param {unknown} origin - Client whose failure is being handled.
   */
  private async handlePotentialAuthError(
    error: unknown,
    origin: unknown
  ): Promise<void> {
    if (this.client !== origin) {
      return;
    }
    const errorMessage = getMcpErrorMessage(error);
    const isAuthError =
      errorMessage.includes("401") ||
      errorMessage.includes("403") ||
      errorMessage.includes("Unauthorized") ||
      errorMessage.includes("Forbidden");

    if (isAuthError) {
      log.warn(
        { connectorId: this.id, errorMessage },
        "Auth error detected, invalidating caches"
      );
      await this.close();
    }
  }
}
