/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { randomUUID } from "node:crypto";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthTokens,
} from "@ai-sdk/mcp";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { mcpFetch } from "@/lib/ai/mcp/mcp-fetch";
/* oxlint-enable sort-imports */
import { withMcpOAuthRefreshLock } from "@/lib/db/mcp-oauth-lock";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
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
/* oxlint-enable sort-imports */
import type { OAuthClientInformationFull } from "@/lib/db/mcp-queries";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { McpOAuthSession } from "@/lib/db/schema";
/* oxlint-enable sort-imports */
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

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (McpOAuthClientProvider); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
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
    onRedirectToAuthorization: (authUrl: URL) => Promise<void>;
    // Optional: adopt existing state (for callback reconciliation)
    state?: string;
  };
  private saveClientInformationPromise: Promise<void> | null = null;

  public constructor(config: {
    mcpConnectorId: string;
    oauthClientId?: string | null;
    oauthClientSecret?: string | null;
    serverUrl: string;
    clientMetadata: OAuthClientMetadata;
    onRedirectToAuthorization: (authUrl: URL) => Promise<void>;
    // Optional: adopt existing state (for callback reconciliation)
    state?: string;
  }) {
    this.config = config;
  }

  private initializationPromise: Promise<void> | null = null;

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve initializeOAuth's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve doInitializeOAuth's awaited sequencing and rejected-Promise behavior. */
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
    if (authenticated?.serverUrl === this.config.serverUrl) {
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
  /* oxlint-enable oxc/no-async-await */
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

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getAuthData's awaited sequencing and rejected-Promise behavior. */
  private async getAuthData() {
    await this.initializeOAuth();
    return this.cachedAuthData;
  }
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve updateAuthData's awaited sequencing and rejected-Promise behavior. */
  private async updateAuthData(data: {
    tokens?: OAuthTokens | null;
    clientInfo?: OAuthClientInformationFull | null;
    codeVerifier?: string | null;
  }) {
    if (!this.currentOAuthState) {
      throw new Error("OAuth not initialized");
    }

    this.cachedAuthData = await updateSessionByState({
      state: this.currentOAuthState,
      updates: data,
    });

    return this.cachedAuthData;
  }
  /* oxlint-enable oxc/no-async-await */
  public get redirectUrl(): string {
    return this.config.clientMetadata.redirect_uris[0];
  }

  public get clientMetadata(): OAuthClientMetadata {
    return this.config.clientMetadata;
  }

  public state(): string {
    return this.currentOAuthState;
  }

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve clientInformation's awaited sequencing and rejected-Promise behavior. */
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
      authData?.clientInfo,
      "client information"
    );
    if (clientInfo && authData) {
      // Security: if redirect URI changed and no tokens yet, invalidate
      if (
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
        // Keep another in-flight authorization's session intact and start a new local state.
        this.cachedAuthData = undefined;
        this.cachedAuthorizationUrl = null;
        this.initialized = false;
        this.currentOAuthState = "";
        this.config.state = undefined;
        await this.initializeOAuth();
        // oxlint-disable-next-line typescript/consistent-return -- This lookup or optional operation intentionally returns no value when the target is absent; callers already handle the value-or-undefined contract.
        return;
      }
      return clientInfo;
    }
  }
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve saveClientInformation's awaited sequencing and rejected-Promise behavior. */
  public async saveClientInformation(
    clientCredentials: OAuthClientInformationFull
  ): Promise<void> {
    if (this.saveClientInformationPromise) {
      await this.saveClientInformationPromise;
      return;
      // If we already have a client registered for this state, keep it stable.
    }
    // Some OAuth servers treat authorization codes as bound to client_id.

    if (this.cachedAuthData?.clientInfo) {
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve tokens's awaited sequencing and rejected-Promise behavior. */
  public async tokens(): Promise<OAuthTokens | undefined> {
    const authData = await this.getAuthData();
    return McpOAuthClientProvider.decodeStoredCredentials(
      storedTokensSchema,
      authData?.tokens,
      "tokens"
    );
  }
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetch's awaited sequencing and rejected-Promise behavior. */
  /** The SDK uses this for transport and OAuth requests, including later 401 refreshes. */
  public fetch = async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const request = new Request(input, init);
    if (
      request.method !== "POST" ||
      !request.headers
        .get("content-type")
        ?.includes("application/x-www-form-urlencoded")
    ) {
      return await mcpFetch(request);
    }
    const params = new URLSearchParams(await request.clone().text());
    if (params.get("grant_type") !== "refresh_token") {
      return await mcpFetch(request);
    }
    // Compare the cached fingerprint only; validate the latest credentials under
    // the lock so a stale malformed cache cannot prevent adopting a repaired row.
    const observedAccessToken = this.cachedAuthData?.tokens?.access_token;
    return await withMcpOAuthRefreshLock(
      this.config.mcpConnectorId,
      async () => {
        request.signal.throwIfAborted();
        const latest = await getSessionByState({
          state: this.currentOAuthState,
        });
        const latestTokens = McpOAuthClientProvider.decodeStoredCredentials(
          storedTokensSchema,
          latest?.tokens,
          "tokens"
        );
        if (
          !latestTokens?.refresh_token ||
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve saveTokens's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve redirectToAuthorization's awaited sequencing and rejected-Promise behavior. */
  public async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve saveCodeVerifier's awaited sequencing and rejected-Promise behavior. */
  public async saveCodeVerifier(pkceVerifier: string): Promise<void> {
    if (this.saveCodeVerifierPromise) {
      await this.saveCodeVerifierPromise;
      return;
      // Only save verifier ONCE - the AI SDK calls this multiple times
    }
    // If we already have a verifier for this session, keep it.
    // but the code_challenge is generated from the FIRST verifier.
    const existingVerifier = this.cachedAuthData?.codeVerifier;

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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve codeVerifier's awaited sequencing and rejected-Promise behavior. */
  public async codeVerifier(): Promise<string> {
    const authData = await this.getAuthData();
    log.info(
      {
        hasCodeVerifier: Boolean(authData?.codeVerifier),
        state: this.currentOAuthState,
      },
      "codeVerifier called"
    );
    if (!authData?.codeVerifier) {
      throw new Error("OAuth code verifier not found");
    }
    return authData.codeVerifier;
  }
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve adoptState's awaited sequencing and rejected-Promise behavior. */
  /**
   * Adopt state from another instance (multi-instance support).
   * Used when the callback needs to reconcile with an existing session.
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve invalidateCredentials's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
}
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
