import type {
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthTokens,
} from "@ai-sdk/mcp";
import type { McpOAuthSession } from "@/lib/db/schema";
import type { OAuthClientInformationFull } from "@/lib/db/mcp-queries";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { mcpFetch } from "@/lib/ai/mcp/mcp-fetch";
import { withMcpOAuthRefreshLock } from "@/lib/db/mcp-oauth-lock";
import {
  createOAuthSession,
  deleteSessionByState,
  getAuthenticatedSession,
  getSessionByState,
  saveTokensAndCleanup,
  setOAuthClientInfoOnceByState,
  setOAuthCodeVerifierOnceByState,
  updateSessionByState,
} from "@/lib/db/mcp-queries";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("mcp-oauth-provider");
const refreshTokensSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().optional(),
  id_token: z.string().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  token_type: z.string(),
});

// @ai-sdk/mcp does not export its runtime OAuth schemas. Match its persisted
// fields, including optional AS pins, while retaining server extension fields.
const oauthUrlSchema = z
  .url()
  .refine(
    (value) =>
      URL.canParse(value) &&
      !/^(?:javascript|data|vbscript):$/u.test(new URL(value).protocol)
  );
const authorizationServerPinShape = {
  authorization_server: oauthUrlSchema.optional(),
  issuer: oauthUrlSchema.optional(),
  token_endpoint: oauthUrlSchema.optional(),
};
const storedTokensSchema = refreshTokensSchema
  .extend(authorizationServerPinShape)
  .loose();
const storedClientInformationSchema = z.looseObject({
  ...authorizationServerPinShape,
  application_type: z.enum(["native", "web"]).optional(),
  client_id: z.string(),
  client_id_issued_at: z.number().optional(),
  client_name: z.string().optional(),
  client_secret: z.string().optional(),
  client_secret_expires_at: z.number().optional(),
  client_uri: oauthUrlSchema.optional(),
  contacts: z.array(z.string()).optional(),
  grant_types: z.array(z.string()).optional(),
  jwks: z.unknown().optional(),
  jwks_uri: oauthUrlSchema.optional(),
  logo_uri: oauthUrlSchema.optional(),
  policy_uri: z.string().optional(),
  redirect_uris: z.array(oauthUrlSchema),
  response_types: z.array(z.string()).optional(),
  scope: z.string().optional(),
  software_id: z.string().optional(),
  software_statement: z.string().optional(),
  software_version: z.string().optional(),
  token_endpoint_auth_method: z.string().optional(),
  tos_uri: oauthUrlSchema.optional(),
});

/**
 * PostgreSQL-backed OAuth client provider for MCP.
 * Implements the OAuthClientProvider interface from the AI SDK.
 * Persists OAuth state, PKCE verifier, client info, and tokens to the database.
 */
export class McpOAuthClientProvider implements OAuthClientProvider {
  private currentOAuthState = "";
  private cachedAuthData: McpOAuthSession | undefined;
  private initialized = false;
  private committedRefreshes = 0;
  private saveCodeVerifierPromise: Promise<void> | null = null;
  private cachedAuthorizationUrl: URL | null = null;
  private readonly config: {
    mcpConnectorId: string;
    oauthClientId?: string | null;
    oauthClientSecret?: string | null;
    serverUrl: string;
    clientMetadata: OAuthClientMetadata;
    onRedirectToAuthorization: (
      authUrl: ReadonlyNativeSurface<URL>
    ) => Promise<void>;
    // Optional: adopt existing state (for callback reconciliation)
    state?: string;
  };
  private saveClientInformationPromise: Promise<void> | null = null;

  public constructor(config: {
    readonly mcpConnectorId: string;
    readonly oauthClientId?: string | null;
    readonly oauthClientSecret?: string | null;
    readonly serverUrl: string;
    readonly clientMetadata: OAuthClientMetadata;
    readonly onRedirectToAuthorization: (
      authUrl: ReadonlyNativeSurface<URL>
    ) => Promise<void>;
    // Optional: adopt existing state (for callback reconciliation)
    readonly state?: string;
  }) {
    this.config = config;
  }

  private initializationPromise: Promise<void> | null = null;

  // Prevent concurrent initialization - return existing promise if in progress

  private async initializeOAuth(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    if (this.initialized) {
      return;
    }

    this.initializationPromise = this.doInitializeOAuth();
    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }
  // If state was provided (e.g., from callback), adopt it

  private async doInitializeOAuth(): Promise<void> {
    if (typeof this.config.state === "string" && this.config.state !== "") {
      const session = await getSessionByState({ state: this.config.state });
      if (
        session &&
        session.mcpConnectorId === this.config.mcpConnectorId &&
        session.serverUrl === this.config.serverUrl
      ) {
        this.currentOAuthState = session.state ?? "";
        this.cachedAuthData = session;
        this.initialized = true;
        return;
      }
      // Check for existing authenticated session
    }
    const authenticated = await getAuthenticatedSession({
      mcpConnectorId: this.config.mcpConnectorId,
    });
    if (authenticated && authenticated.serverUrl === this.config.serverUrl) {
      this.currentOAuthState = authenticated.state ?? "";
      this.cachedAuthData = authenticated;
      this.initialized = true;
      return;
      // Create new in-progress session
    }
    this.currentOAuthState = randomUUID();
    this.cachedAuthData = await createOAuthSession({
      mcpConnectorId: this.config.mcpConnectorId,
      serverUrl: this.config.serverUrl,
      state: this.currentOAuthState,
    });
    this.initialized = true;
  }
  private static decodeStoredCredentials<Result>(
    schema: Readonly<Pick<z.ZodType<Result>, "safeParse">>,
    value: unknown,
    kind: "client information" | "tokens"
  ): Result | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    const result = schema.safeParse(value);
    if (!result.success) {
      // Do not expose secrets in validation errors or mutate another flow's state.
      throw new Error(
        `Invalid stored MCP OAuth ${kind}; reconnect this connector.`
      );
    }
    return result.data;
  }

  private async getAuthData(): Promise<McpOAuthSession | undefined> {
    await this.initializeOAuth();
    return this.cachedAuthData;
  }
  private async updateAuthData(
    data: Parameters<typeof updateSessionByState>[0]["updates"]
  ): Promise<McpOAuthSession> {
    if (!this.currentOAuthState) {
      throw new Error("OAuth not initialized");
    }

    this.cachedAuthData = await updateSessionByState({
      state: this.currentOAuthState,
      updates: data,
    });

    return this.cachedAuthData;
  }
  public get redirectUrl(): string {
    return this.config.clientMetadata.redirect_uris[0];
  }

  public get clientMetadata(): OAuthClientMetadata {
    return this.config.clientMetadata;
  }

  public state(): string {
    return this.currentOAuthState;
  }

  public async clientInformation(): Promise<
    OAuthClientInformationFull | undefined
  > {
    const authData = await this.getAuthData();
    if (
      typeof this.config.oauthClientId === "string" &&
      this.config.oauthClientId !== ""
    ) {
      return {
        ...this.clientMetadata,
        client_id: this.config.oauthClientId,
        client_secret: this.config.oauthClientSecret ?? undefined,
      };
    }
    const clientInfo = McpOAuthClientProvider.decodeStoredCredentials(
      storedClientInformationSchema,
      (authData ?? {}).clientInfo,
      "client information"
    );
    // Security: if redirect URI changed and no tokens yet, invalidate
    if (
      clientInfo &&
      authData &&
      !authData.tokens &&
      clientInfo.redirect_uris[0] !== this.redirectUrl
    ) {
      log.warn(
        {
          currentRedirectUri: this.redirectUrl,
          savedRedirectUri: clientInfo.redirect_uris[0],
          state: authData.state,
        },
        "clientInformation: redirect URI mismatch, invalidating session"
      );
      this.resetRegistration();
      await this.initializeOAuth();
      return undefined;
    }
    return clientInfo;
  }
  // Keep other in-flight sessions intact while resetting this registration in order.
  private resetRegistration(): void {
    this.cachedAuthData = undefined;
    this.cachedAuthorizationUrl = null;
    this.initialized = false;
    this.currentOAuthState = "";
    this.config.state = undefined;
  }
  public async saveClientInformation(
    clientCredentials: Parameters<
      typeof setOAuthClientInfoOnceByState
    >[0]["clientInfo"]
  ): Promise<void> {
    if (this.saveClientInformationPromise) {
      await this.saveClientInformationPromise;
      return;
      // If we already have a client registered for this state, keep it stable.
    }
    // Some OAuth servers treat authorization codes as bound to client_id.

    if ((this.cachedAuthData ?? {}).clientInfo) {
      return;
    }
    this.saveClientInformationPromise = (async (): Promise<void> => {
      try {
        this.cachedAuthData = await setOAuthClientInfoOnceByState({
          clientInfo: clientCredentials,
          state: this.currentOAuthState,
        });
      } finally {
        this.saveClientInformationPromise = null;
      }
    })();
    await this.saveClientInformationPromise;
  }
  public async tokens(): Promise<OAuthTokens | undefined> {
    const authData = await this.getAuthData();
    return McpOAuthClientProvider.decodeStoredCredentials(
      storedTokensSchema,
      (authData ?? {}).tokens,
      "tokens"
    );
  }
  /**
   * Send SDK transport requests and serialize refresh-token rotation under the connector lock.
   * @param {string | URL | Request} input - Native request source, passed unchanged to Request.
   * @param {RequestInit} [init] - Native request options, including headers, body and cancellation.
   * @returns {Promise<Response>} Transport response after any successful token rotation is persisted.
   */
  public fetch = async (
    input: string | ReadonlyNativeSurface<URL | Request>,
    init?: RequestInit
  ): Promise<Response> => {
    const request = new Request(input, init);
    if (
      request.method !== "POST" ||
      !(request.headers.get("content-type") ?? "").includes(
        "application/x-www-form-urlencoded"
      )
    ) {
      return await mcpFetch(request);
    }
    const params = new URLSearchParams(await request.clone().text());
    if (params.get("grant_type") !== "refresh_token") {
      return await mcpFetch(request);
    }
    // Compare the cached fingerprint only; validate the latest credentials under
    // the lock so a stale malformed cache cannot prevent adopting a repaired row.
    const observedAccessToken = ((this.cachedAuthData ?? {}).tokens ?? {})
      .access_token;
    return await withMcpOAuthRefreshLock(
      this.config.mcpConnectorId,
      async () => {
        request.signal.throwIfAborted();
        const latest = await getSessionByState({
          state: this.currentOAuthState,
        });
        const latestTokens = McpOAuthClientProvider.decodeStoredCredentials(
          storedTokensSchema,
          (latest ?? {}).tokens,
          "tokens"
        );
        const refreshToken = (latestTokens ?? {}).refresh_token;
        if (
          !latestTokens ||
          typeof refreshToken !== "string" ||
          refreshToken === "" ||
          !latest ||
          latest.mcpConnectorId !== this.config.mcpConnectorId ||
          latest.serverUrl !== this.config.serverUrl
        ) {
          throw new Error("MCP credentials changed; reconnect this connector.");
        }
        if (
          latestTokens.refresh_token !== params.get("refresh_token") ||
          latestTokens.access_token !== observedAccessToken
        ) {
          // Another instance already rotated this credential. Return its result
          // to the SDK instead of consuming the old single-use refresh token.
          this.cachedAuthData = latest;
          this.committedRefreshes += 1;
          return Response.json(latestTokens);
        }
        const response = await mcpFetch(request, {
          signal: AbortSignal.any([
            request.signal,
            AbortSignal.timeout(30_000),
          ]),
        });
        if (!response.ok) {
          return response;
        }
        const refreshed = refreshTokensSchema.parse(
          await response.clone().json()
        );
        // A successful rotation must be committed even if the caller cancelled:
        // the previous refresh token may already be invalid at the server.
        // Preserve pinned metadata and the refresh token when it is not rotated.
        this.cachedAuthData = await saveTokensAndCleanup({
          mcpConnectorId: this.config.mcpConnectorId,
          state: this.currentOAuthState,
          tokens: { ...latestTokens, ...refreshed },
        });
        this.committedRefreshes += 1;
        return Response.json(refreshed);
      },
      request.signal
    );
  };
  public async saveTokens(tokens: OAuthTokens): Promise<void> {
    if (this.committedRefreshes > 0) {
      // Refresh was saved while holding the cross-process lock. The SDK's
      // later save must not overwrite a newer rotation from another client.
      this.committedRefreshes -= 1;
      this.cachedAuthData = await getSessionByState({
        state: this.currentOAuthState,
      });
      return;
    }
    this.cachedAuthData = await saveTokensAndCleanup({
      mcpConnectorId: this.config.mcpConnectorId,
      state: this.currentOAuthState,
      tokens,
    });
  }
  public async redirectToAuthorization(
    authorizationUrl: ReadonlyNativeSurface<URL>
  ): Promise<void> {
    // If the SDK calls redirect twice, keep the first URL stable.
    authorizationUrl.searchParams.set("state", this.state());
    // Otherwise the UI might open URL #1 while the DB ended up with verifier #2.

    if (this.cachedAuthorizationUrl) {
      await this.config.onRedirectToAuthorization(this.cachedAuthorizationUrl);
      return;
    }
    this.cachedAuthorizationUrl = new URL(authorizationUrl.toString());

    await this.config.onRedirectToAuthorization(authorizationUrl);
  }
  public async saveCodeVerifier(pkceVerifier: string): Promise<void> {
    if (this.saveCodeVerifierPromise) {
      await this.saveCodeVerifierPromise;
      return;
      // Only save verifier ONCE - the AI SDK calls this multiple times
    }
    // If we already have a verifier for this session, keep it.
    // but the code_challenge is generated from the FIRST verifier.
    const existingVerifier = (this.cachedAuthData ?? {}).codeVerifier;

    if (typeof existingVerifier === "string" && existingVerifier !== "") {
      log.info(
        {
          state: this.currentOAuthState,
        },
        "saveCodeVerifier: SKIPPING - verifier already exists"
      );

      return;
    }

    log.info(
      {
        state: this.currentOAuthState,
      },
      "saveCodeVerifier: saving first verifier"
      // Optimistic in-memory set so a concurrent call in this instance will skip.
    );
    if (this.cachedAuthData) {
      this.cachedAuthData = {
        ...this.cachedAuthData,
        codeVerifier: pkceVerifier,
      };
      // Serialize and make the DB write immutable (DB-side also guards against overwrite).
    }
    this.saveCodeVerifierPromise = (async (): Promise<void> => {
      try {
        this.cachedAuthData = await setOAuthCodeVerifierOnceByState({
          codeVerifier: pkceVerifier,
          state: this.currentOAuthState,
        });
      } finally {
        this.saveCodeVerifierPromise = null;
      }
    })();
    await this.saveCodeVerifierPromise;
  }
  public async codeVerifier(): Promise<string> {
    const authData = await this.getAuthData();
    log.info(
      {
        hasCodeVerifier: Boolean((authData ?? {}).codeVerifier),
        state: this.currentOAuthState,
      },
      "codeVerifier called"
    );
    if (
      !authData ||
      typeof authData.codeVerifier !== "string" ||
      authData.codeVerifier === ""
    ) {
      throw new Error("OAuth code verifier not found");
    }
    return authData.codeVerifier;
  }
  /**
   * Adopt state from another instance (multi-instance support).
   * Used when the callback needs to reconcile with an existing session.
   * @param {string} state - Candidate persisted state; absent or foreign-connector rows are ignored.
   */
  public async adoptState(state: string): Promise<void> {
    if (!state) {
      log.warn("adoptState called with empty state");
      return;
      // If already initialized with this exact state, skip DB lookup
    }
    if (this.initialized && this.currentOAuthState === state) {
      log.info({ state }, "adoptState: already initialized with this state");
      return;
    }

    const session = await getSessionByState({ state });
    if (!session) {
      log.warn({ state }, "adoptState: session not found");
      return;
    }
    if (session.mcpConnectorId !== this.config.mcpConnectorId) {
      log.warn(
        {
          expectedConnectorId: this.config.mcpConnectorId,
          sessionConnectorId: session.mcpConnectorId,
          state,
        },
        "adoptState: connector ID mismatch"
      );
      return;
    }
    if (session.serverUrl !== this.config.serverUrl) {
      throw new Error("OAuth session belongs to a different MCP server");
    }
    log.info(
      {
        hasClientInfo: Boolean(session.clientInfo),
        hasCodeVerifier: Boolean(session.codeVerifier),
        hasTokens: Boolean(session.tokens),
        previousState: this.currentOAuthState,
        state,
        wasInitialized: this.initialized,
      },
      "adoptState: adopting session (overriding previous state if any)"
    );
    this.currentOAuthState = state;
    this.cachedAuthData = session;
    this.initialized = true;
  }
  public async invalidateCredentials(
    scope: "all" | "client" | "tokens" | "verifier"
  ): Promise<void> {
    if (scope === "all" || scope === "client") {
      this.cachedAuthorizationUrl = null;
    }
    if (scope === "all") {
      await deleteSessionByState({ state: this.currentOAuthState });
      this.cachedAuthData = undefined;
      this.initialized = false;
      this.currentOAuthState = "";
    } else if (scope === "tokens") {
      await this.updateAuthData({ tokens: null });
      // Clear client credentials - this forces re-registration with the OAuth server
    } else if (scope === "client") {
      // Reset state since client info is foundational to the OAuth flow
      await this.updateAuthData({ clientInfo: null });
      this.initialized = false;
      this.currentOAuthState = "";
      this.cachedAuthData = undefined;
      // Clear the PKCE verifier - this invalidates any pending authorization
    } else if (scope === "verifier") {
      // Clear cached authorization URL since it's tied to the old verifier
      await this.updateAuthData({ codeVerifier: null });
      this.cachedAuthorizationUrl = null;
    }
  }
}
