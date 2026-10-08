import {
  auth,
  experimental_createMCPClient as createMCPClient,
} from "@ai-sdk/mcp";
import type {
  ListPromptsResult,
  ListResourcesResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { Tool } from "ai";

import { McpOAuthClientProvider } from "@/lib/ai/mcp/mcp-oauth-provider";
import { OAuthAuthorizationRequiredError } from "@/lib/ai/mcp/oauth-authorization-required-error";
import { config } from "@/lib/config";
import { createModuleLogger } from "@/lib/logger";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
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

type McpClientInstance = Awaited<ReturnType<typeof createMCPClient>>;

type McpClientStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "authorizing"
  | "incompatible";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (MCPClient); the enabled import/no-default-export convention rejects the default-export alternative. */
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

  // oxlint-disable-next-line eslint/max-params -- Preserve the public connector identity, display name, transport configuration, and invalidation callback arguments used by both client factories.
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
          // oxlint-disable-next-line no-ternary -- Keep token_endpoint_auth_method as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Class client is absent before connection and reset to undefined by close; serverInfo getter must remain absent then.
    return this.client?.serverInfo;
  }

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve connect's awaited sequencing and rejected-Promise behavior. */
  // oxlint-disable-next-line eslint/max-statements -- Register the caller cancellation listener after shared initialization and remove it in finally; moving statements would change which callers join the shared promise.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Connect exposes an optional caller AbortSignal; omitted signal still permits shared initialization.
    abortSignal?.throwIfAborted();
    if (!this.connectPromise) {
      // oxlint-disable-next-line promise/prefer-await-to-then -- Shared initialization clears independently of any cancelled caller's wait.
      const promise = this.connectOnce(oauthState).finally((): void => {
        if (this.connectPromise === promise) {
          // oxlint-disable-next-line eslint/no-undefined -- Preserve the explicit optional argument, absent state value, or error own-key sentinel in the native client lifecycle.
          this.connectPromise = undefined;
        }
      });
      this.connectPromise = promise;
    }
    if (!abortSignal) {
      return await this.connectPromise;
    }
    const aborted = Promise.withResolvers<never>();
    const cancel = (): void => aborted.reject(abortSignal.reason);
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve connectOnce's awaited sequencing and rejected-Promise behavior. */
  // oxlint-disable-next-line eslint/max-statements, eslint/max-lines-per-function -- OAuth adoption, guarded SDK initialization, generation checks, client assignment, and error classification form one ordered connection attempt.
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
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Bun requires preconnect on @ai-sdk/mcp's FetchFunction, but oauthProvider.fetch omits it to keep requests guarded. MCP calls only the guarded fetch; removing this assertion fails Registry type-checking (TS2741).
          fetch: oauthProvider.fetch as typeof globalThis.fetch,
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
      // oxlint-disable-next-line eslint/no-undefined -- Preserve the explicit optional argument, absent state value, or error own-key sentinel in the native client lifecycle.
      this.authorizationUrl = undefined;
      this.connectionStatus = "connected";
      return this.client;
    } catch (error) {
      if (generation !== this.generation || signal.aborted) {
        if (generation === this.generation) {
          // oxlint-disable-next-line eslint/no-undefined -- Preserve the explicit optional argument, absent state value, or error own-key sentinel in the native client lifecycle.
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
        // oxlint-disable-next-line eslint/no-undefined -- Preserve the explicit optional argument, absent state value, or error own-key sentinel in the native client lifecycle.
        return undefined;
      }

      this.connectionStatus = "disconnected";
      throw error;
    }
  }
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve attemptConnection's awaited sequencing and rejected-Promise behavior. */
  /**
   * Lightweight connection test - just checks if we can connect without full discovery.
   * Returns connection status without fetching tools/resources/prompts.
   * @param {Readonly<Pick<AbortSignal, "throwIfAborted" | "reason" | "addEventListener" | "removeEventListener" | "aborted">> | undefined} abortSignal - Cancels this caller while shared initialization continues.
   * @returns {Promise<{ status: McpClientStatus; needsAuth: boolean; error?: string; }>} The connection or authorization status.
   */
  // oxlint-disable-next-line eslint/max-statements, eslint/max-lines-per-function -- Keep cached status fast paths, the awaited connection attempt, and error classification in the same status operation.
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
      // oxlint-disable-next-line eslint/no-undefined -- Preserve the explicit optional argument, absent state value, or error own-key sentinel in the native client lifecycle.
      await this.connect(undefined, abortSignal);
      // Check if OAuth is required (authorizationUrl gets set during connect)
      // oxlint-disable-next-line eslint/no-undefined -- Preserve the explicit optional argument, absent state value, or error own-key sentinel in the native client lifecycle.
      if (this.authorizationUrl !== undefined) {
        return { needsAuth: true, status: "authorizing" };
      }
      return {
        needsAuth: false,
        // oxlint-disable-next-line no-ternary -- Keep status as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        status: this.client ? "connected" : "disconnected",
      };
    } catch (error) {
      const errorMessage = getMcpErrorMessage(error);
      log.error(
        {
          connectorId: this.id,
          errorMessage,
          // oxlint-disable-next-line no-ternary, eslint/no-undefined -- Keep errorStack as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary. Preserve the explicit absent errorStack own-key sentinel.
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve finishAuth's awaited sequencing and rejected-Promise behavior. */
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
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Bun requires preconnect on @ai-sdk/mcp's FetchFunction, but oauthProvider.fetch omits it to keep requests guarded. MCP calls only the guarded fetch; removing this assertion fails Registry type-checking (TS2741).
      fetchFn: oauthProvider.fetch as typeof globalThis.fetch,
      serverUrl: this.serverConfig.url,
    });

    if (generation !== this.generation) {
      throw new Error("MCP connection was closed");
    }
    // oxlint-disable-next-line eslint/no-undefined -- Preserve the explicit optional argument, absent state value, or error own-key sentinel in the native client lifecycle.
    this.authorizationUrl = undefined;
    // Don't set to connected - tokens are saved, next connect() will use them
  }
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve tools's awaited sequencing and rejected-Promise behavior. */
  /**
   * Get tools from the MCP server, already in AI SDK format.
   * @param {Parameters<McpClientInstance["tools"]>} args - Native SDK schema options.
   * @returns {Promise<Record<string, Tool>>} The discovered SDK tools.
   */
  public async tools(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the original MCP SDK tools argument tuple; deep readonly schema inputs fail client.tools (TS2345).
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve listResources's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve listPrompts's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve close's awaited sequencing and rejected-Promise behavior. */
  /**
   * Close the connection to the MCP server.
   */
  // oxlint-disable-next-line eslint/max-statements -- Abort initialization and reset the generation/provider/client before awaiting close, then invalidate cached status after cleanup.
  public async close(): Promise<void> {
    this.generation += 1;
    // oxlint-disable-next-line oxc/no-optional-chaining -- Connection abort controller is optional before the first initialization; close also works before connecting.
    this.connectionAbort?.abort(new Error("MCP connection was closed"));
    // oxlint-disable-next-line eslint/no-undefined -- Preserve the explicit optional argument, absent state value, or error own-key sentinel in the native client lifecycle.
    this.connectPromise = undefined;
    this.oauthProvider = this.createOAuthProvider();
    const { client } = this;
    // oxlint-disable-next-line eslint/no-undefined -- Preserve the explicit optional argument, absent state value, or error own-key sentinel in the native client lifecycle.
    this.client = undefined;
    // oxlint-disable-next-line eslint/no-undefined -- Preserve the explicit optional argument, absent state value, or error own-key sentinel in the native client lifecycle.
    this.authorizationUrl = undefined;
    this.connectionStatus = "disconnected";
    try {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Close snapshots possibly absent class client then resets it. await client?.close() also preserves a microtask yield when no client exists; an if(client) without await would change invalidation timing.
      await client?.close();
    } catch (error) {
      log.error({ connectorId: this.id, error }, "Error closing MCP client");
    }
    // oxlint-disable-next-line oxc/no-optional-chaining -- Optional cache invalidation callback is supplied by client configuration; closing must work with no callback.
    this.invalidateCache?.();
  }
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve handlePotentialAuthError's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
}
/* oxlint-enable import/prefer-default-export, import/no-named-export */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
