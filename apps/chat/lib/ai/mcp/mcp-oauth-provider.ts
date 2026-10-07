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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing authorizationServerPinShape own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/**
 * PostgreSQL-backed OAuth client provider for MCP.
 * Implements the OAuthClientProvider interface from the AI SDK.
 * Persists OAuth state, PKCE verifier, client info, and tokens to the database.
 */
export class McpOAuthClientProvider implements OAuthClientProvider {
  private currentOAuthState = "";
  private cachedAuthData: McpOAuthSession | undefined;
  private initialized = false;
  // oxlint-disable-next-line eslint/no-magic-numbers -- Zero means no persisted refreshes are awaiting SDK acknowledgement; use the local count rather than an unrelated numeric alias.
  private committedRefreshes = 0;
  // oxlint-disable-next-line unicorn/no-null -- Null marks an idle coalesced promise or absent cached authorization URL; preserve this existing cache-state sentinel rather than exchanging it for an undefined convention exception.
  private saveCodeVerifierPromise: Promise<void> | null = null;
  // oxlint-disable-next-line unicorn/no-null -- Null marks an idle coalesced promise or absent cached authorization URL; preserve this existing cache-state sentinel rather than exchanging it for an undefined convention exception.
  private cachedAuthorizationUrl: URL | null = null;
  private readonly config: {
    mcpConnectorId: string;
    oauthClientId?: string | null;
    oauthClientSecret?: string | null;
    serverUrl: string;
    clientMetadata: OAuthClientMetadata;
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Keep the native URL callback contract, including its mutable searchParams receiver; shallow Readonly<URL> still fails the enabled recursive readonly rule.
    onRedirectToAuthorization: (authUrl: URL) => Promise<void>;
    // Optional: adopt existing state (for callback reconciliation)
    state?: string;
  };
  // oxlint-disable-next-line unicorn/no-null -- Null marks an idle coalesced promise or absent cached authorization URL; preserve this existing cache-state sentinel rather than exchanging it for an undefined convention exception.
  private saveClientInformationPromise: Promise<void> | null = null;

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Constructor retains and later resets the caller's state property, and exposes the same metadata object through the mutable SDK getter; a readonly ownership change would alter those aliases.
  public constructor(config: {
    mcpConnectorId: string;
    oauthClientId?: string | null;
    oauthClientSecret?: string | null;
    serverUrl: string;
    clientMetadata: OAuthClientMetadata;
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Keep the native URL callback contract, including its mutable searchParams receiver; shallow Readonly<URL> still fails the enabled recursive readonly rule.
    onRedirectToAuthorization: (authUrl: URL) => Promise<void>;
    // Optional: adopt existing state (for callback reconciliation)
    state?: string;
  }) {
    this.config = config;
  }

  // oxlint-disable-next-line unicorn/no-null -- Null marks an idle coalesced promise or absent cached authorization URL; preserve this existing cache-state sentinel rather than exchanging it for an undefined convention exception.
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
      // oxlint-disable-next-line unicorn/no-null -- Null marks an idle coalesced promise or absent cached authorization URL; preserve this existing cache-state sentinel rather than exchanging it for an undefined convention exception.
      this.initializationPromise = null;
    }
  }
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve doInitializeOAuth's awaited sequencing and rejected-Promise behavior. */
  // If state was provided (e.g., from callback), adopt it

  /* oxlint-disable eslint/max-statements -- This initialization coordinates supplied-state reconciliation, authenticated-session reuse and fresh-session persistence; the ordered state-machine reduction remains under review. */
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- getAuthenticatedSession is a database lookup that can yield no authenticated session; no-row result must fall through to existing state initialization.
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
  /* oxlint-enable eslint/max-statements */
  /* oxlint-enable oxc/no-async-await */
  private static decodeStoredCredentials<Result>(
    schema: Readonly<Pick<z.ZodType<Result>, "safeParse">>,
    value: unknown,
    kind: "client information" | "tokens"
  ): Result | undefined {
    // oxlint-disable-next-line eslint/no-undefined -- Stored database credentials may be null or absent; both decode to the SDK's missing-credentials result.
    if (value === null || value === undefined) {
      // oxlint-disable-next-line eslint/no-undefined -- The SDK represents unavailable client information or tokens with undefined; no replacement credential object is returned.
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
  private async getAuthData(): Promise<McpOAuthSession | undefined> {
    await this.initializeOAuth();
    return this.cachedAuthData;
  }
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve updateAuthData's awaited sequencing and rejected-Promise behavior. */
  private async updateAuthData(
    // oxlint-disable-next-line eslint/no-magic-numbers -- Select the existing database writer's first parameter contract by its tuple index; no runtime numeric value is introduced.
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
  /* oxlint-enable oxc/no-async-await */
  public get redirectUrl(): string {
    // oxlint-disable-next-line eslint/no-magic-numbers -- OAuth client metadata selects the first registered redirect URI by its zero-based array index.
    return this.config.clientMetadata.redirect_uris[0];
  }

  public get clientMetadata(): OAuthClientMetadata {
    return this.config.clientMetadata;
  }

  public state(): string {
    return this.currentOAuthState;
  }

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve clientInformation's awaited sequencing and rejected-Promise behavior. */
  /* oxlint-disable eslint/max-statements -- Client registration chooses configured credentials or validates stored credentials and reconciles pinned authorization-server metadata; a smaller registration boundary remains under review. */
  public async clientInformation(): Promise<
    OAuthClientInformationFull | undefined
  > {
    const authData = await this.getAuthData();
    if (
      typeof this.config.oauthClientId === "string" &&
      this.config.oauthClientId !== ""
    ) {
      return {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing this.clientMetadata own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...this.clientMetadata,
        client_id: this.config.oauthClientId,
        // oxlint-disable-next-line eslint/no-undefined -- A null configured client secret becomes an omitted optional SDK secret, preserving public-client registration.
        client_secret: this.config.oauthClientSecret ?? undefined,
      };
    }
    const clientInfo = McpOAuthClientProvider.decodeStoredCredentials(
      storedClientInformationSchema,
      // oxlint-disable-next-line oxc/no-optional-chaining -- getAuthData can return no session row; credential decoder intentionally receives undefined and returns no client information.
      authData?.clientInfo,
      "client information"
    );
    if (clientInfo && authData) {
      // Security: if redirect URI changed and no tokens yet, invalidate
      if (
        !authData.tokens &&
        // oxlint-disable-next-line eslint/no-magic-numbers -- OAuth client metadata selects the first registered redirect URI by its zero-based array index.
        clientInfo.redirect_uris[0] !== this.redirectUrl
      ) {
        log.warn(
          {
            currentRedirectUri: this.redirectUrl,
            // oxlint-disable-next-line eslint/no-magic-numbers -- OAuth client metadata selects the first registered redirect URI by its zero-based array index.
            savedRedirectUri: clientInfo.redirect_uris[0],
            state: authData.state,
          },
          "clientInformation: redirect URI mismatch, invalidating session"
        );
        // Keep another in-flight authorization's session intact and start a new local state.
        // oxlint-disable-next-line eslint/no-undefined -- Discard the cached session after invalidation or redirect reconciliation so a later read reloads or initializes it.
        this.cachedAuthData = undefined;
        // oxlint-disable-next-line unicorn/no-null -- Null marks an idle coalesced promise or absent cached authorization URL; preserve this existing cache-state sentinel rather than exchanging it for an undefined convention exception.
        this.cachedAuthorizationUrl = null;
        this.initialized = false;
        this.currentOAuthState = "";
        // oxlint-disable-next-line eslint/no-undefined -- Clear the same caller-owned optional state property before fresh OAuth initialization; null would not represent an absent optional state.
        this.config.state = undefined;
        await this.initializeOAuth();
        // oxlint-disable-next-line typescript/consistent-return -- This lookup or optional operation intentionally returns no value when the target is absent; callers already handle the value-or-undefined contract.
        return;
      }
      return clientInfo;
    }
  }
  /* oxlint-enable eslint/max-statements */
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve saveClientInformation's awaited sequencing and rejected-Promise behavior. */
  public async saveClientInformation(
    clientCredentials: Parameters<
      typeof setOAuthClientInfoOnceByState
      // oxlint-disable-next-line eslint/no-magic-numbers -- Zero means no persisted refreshes are awaiting SDK acknowledgement; use the local count rather than an unrelated numeric alias.
    >[0]["clientInfo"]
  ): Promise<void> {
    if (this.saveClientInformationPromise) {
      await this.saveClientInformationPromise;
      return;
      // If we already have a client registered for this state, keep it stable.
    }
    // Some OAuth servers treat authorization codes as bound to client_id.

    // oxlint-disable-next-line oxc/no-optional-chaining -- OAuth cache can be absent before registration; only a cached clientInfo record should suppress duplicate client registration.
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
        // oxlint-disable-next-line unicorn/no-null -- Null marks an idle coalesced promise or absent cached authorization URL; preserve this existing cache-state sentinel rather than exchanging it for an undefined convention exception.
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
      // oxlint-disable-next-line oxc/no-optional-chaining -- getAuthData can return no session row; token decoder intentionally receives undefined and returns no credentials.
      authData?.tokens,
      "tokens"
    );
  }
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetch's awaited sequencing and rejected-Promise behavior. */
  /**
   * Send SDK transport requests and serialize refresh-token rotation under the connector lock.
   * @param {string | URL | Request} input - Native request source, passed unchanged to Request.
   * @param {RequestInit} [init] - Native request options, including headers, body and cancellation.
   * @returns {Promise<Response>} Transport response after any successful token rotation is persisted.
   */
  public fetch =
    /* oxlint-disable eslint/max-lines-per-function -- SDK transport and refresh requests share this entry point and connector-lock transaction; reducing the refresh workflow length remains under review. */ async (
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward native Request and RequestInit unchanged into Request; readonly header/body projections are not accepted by the native transport constructor.
      input: string | URL | Request,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward native Request and RequestInit unchanged into Request; readonly header/body projections are not accepted by the native transport constructor.
      init?: RequestInit
    ): Promise<Response> => {
      const request = new Request(input, init);
      if (
        request.method !== "POST" ||
        // oxlint-disable-next-line oxc/no-optional-chaining -- Native Headers.get returns null when Content-Type is absent; such requests must use ordinary mcpFetch rather than the OAuth-refresh branch. Absent Content-Type and a false media-type match both use ordinary transport; preserve the native Headers.get null sentinel and boolean match.
        request.headers
          .get("content-type")
          ?.includes("application/x-www-form-urlencoded") !== true
      ) {
        return await mcpFetch(request);
      }
      const params = new URLSearchParams(await request.clone().text());
      if (params.get("grant_type") !== "refresh_token") {
        return await mcpFetch(request);
      }
      // Compare the cached fingerprint only; validate the latest credentials under
      // the lock so a stale malformed cache cannot prevent adopting a repaired row.
      // oxlint-disable-next-line oxc/no-optional-chaining -- OAuth auth cache starts absent and may have no saved token record; fingerprint observation must remain undefined so repaired latest credentials can be adopted under the lock.
      const observedAccessToken = this.cachedAuthData?.tokens?.access_token;
      return await withMcpOAuthRefreshLock(
        this.config.mcpConnectorId,
        /* oxlint-disable eslint/max-statements -- The refresh lock covers cancellation, latest-session validation, credential reuse, transport and atomic token persistence; splitting this transaction remains under review. */
        async () => {
          request.signal.throwIfAborted();
          const latest = await getSessionByState({
            state: this.currentOAuthState,
          });
          const latestTokens = McpOAuthClientProvider.decodeStoredCredentials(
            storedTokensSchema,
            // oxlint-disable-next-line oxc/no-optional-chaining -- Latest state database query can return no row after concurrent deletion; decoder/validation must reject absent credentials rather than dereference them.
            latest?.tokens,
            "tokens"
          );
          if (
            // oxlint-disable-next-line oxc/no-optional-chaining, typescript/strict-boolean-expressions -- decodeStoredCredentials returns undefined for absent credentials; absent refresh_token must reject the refreshed-session reuse path before sending a refresh request. Reject absent or empty refresh tokens before sending a refresh request; the stored-token schema produces optional string credentials.
            !latestTokens?.refresh_token ||
            !latest ||
            latest.mcpConnectorId !== this.config.mcpConnectorId ||
            latest.serverUrl !== this.config.serverUrl
          ) {
            throw new Error(
              "MCP credentials changed; reconnect this connector."
            );
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
              // oxlint-disable-next-line eslint/no-magic-numbers -- OAuth refresh transport has a 30-second cancellation deadline, expressed in native AbortSignal.timeout milliseconds.
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
            // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing latestTokens own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing refreshed own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
            tokens: { ...latestTokens, ...refreshed },
          });
          this.committedRefreshes += 1;
          return Response.json(refreshed);
        },
        /* oxlint-enable eslint/max-statements */ request.signal
      );
    }; /* oxlint-enable eslint/max-lines-per-function */
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve saveTokens's awaited sequencing and rejected-Promise behavior. */
  public async saveTokens(tokens: OAuthTokens): Promise<void> {
    // oxlint-disable-next-line eslint/no-magic-numbers -- Zero means no persisted refreshes are awaiting SDK acknowledgement; use the local count rather than an unrelated numeric alias.
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Keep the native URL callback contract, including its mutable searchParams receiver; shallow Readonly<URL> still fails the enabled recursive readonly rule.
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
  /* oxlint-disable eslint/max-statements -- The first-write PKCE operation combines cached-verifier reconciliation, optimistic cache state and a coalesced persistence promise; its statement reduction remains under review. */
  public async saveCodeVerifier(pkceVerifier: string): Promise<void> {
    if (this.saveCodeVerifierPromise) {
      await this.saveCodeVerifierPromise;
      return;
      // Only save verifier ONCE - the AI SDK calls this multiple times
    }
    // If we already have a verifier for this session, keep it.
    // but the code_challenge is generated from the FIRST verifier.
    // oxlint-disable-next-line oxc/no-optional-chaining -- OAuth cache can lack a saved codeVerifier; missing verifier must allow the existing first-save path instead of throwing.
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing this.cachedAuthData own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
        // oxlint-disable-next-line unicorn/no-null -- Null marks an idle coalesced promise or absent cached authorization URL; preserve this existing cache-state sentinel rather than exchanging it for an undefined convention exception.
        this.saveCodeVerifierPromise = null;
      }
    })();
    await this.saveCodeVerifierPromise;
  }
  /* oxlint-enable eslint/max-statements */
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve codeVerifier's awaited sequencing and rejected-Promise behavior. */
  public async codeVerifier(): Promise<string> {
    const authData = await this.getAuthData();
    log.info(
      {
        // oxlint-disable-next-line oxc/no-optional-chaining -- getAuthData can yield no session row/verifier. Both logging Boolean and explicit rejection guard preserve the missing-code-verifier error rather than throwing on property access.
        hasCodeVerifier: Boolean(authData?.codeVerifier),
        state: this.currentOAuthState,
      },
      "codeVerifier called"
    );
    // oxlint-disable-next-line oxc/no-optional-chaining, typescript/strict-boolean-expressions -- getAuthData can yield no session row/verifier. Both logging Boolean and explicit rejection guard preserve the missing-code-verifier error rather than throwing on property access. Reject both absent and empty stored PKCE verifiers with the existing OAuth error; this row field is string or null.
    if (!authData?.codeVerifier) {
      throw new Error("OAuth code verifier not found");
    }
    return authData.codeVerifier;
  }
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve adoptState's awaited sequencing and rejected-Promise behavior. */
  /* oxlint-disable eslint/max-statements -- State adoption validates connector/server ownership before publishing the session and initialization flag; a smaller transition boundary remains under review. */
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
  /* oxlint-enable eslint/max-statements */
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve invalidateCredentials's awaited sequencing and rejected-Promise behavior. */
  /* oxlint-disable eslint/max-statements -- Each SDK invalidation scope requires a distinct database operation followed by its matching cache/state reset; reducing these branch statements remains under review. */
  public async invalidateCredentials(
    scope: "all" | "client" | "tokens" | "verifier"
  ): Promise<void> {
    if (scope === "all" || scope === "client") {
      // oxlint-disable-next-line unicorn/no-null -- Null marks an idle coalesced promise or absent cached authorization URL; preserve this existing cache-state sentinel rather than exchanging it for an undefined convention exception.
      this.cachedAuthorizationUrl = null;
    }
    if (scope === "all") {
      await deleteSessionByState({ state: this.currentOAuthState });
      // oxlint-disable-next-line eslint/no-undefined -- Discard the cached session after invalidation or redirect reconciliation so a later read reloads or initializes it.
      this.cachedAuthData = undefined;
      this.initialized = false;
      this.currentOAuthState = "";
    } else if (scope === "tokens") {
      // oxlint-disable-next-line unicorn/no-null -- Explicit null clears this stored OAuth credential column; omission preserves the current value.
      await this.updateAuthData({ tokens: null });
      // Clear client credentials - this forces re-registration with the OAuth server
    } else if (scope === "client") {
      // Reset state since client info is foundational to the OAuth flow
      // oxlint-disable-next-line unicorn/no-null -- Explicit null clears this stored OAuth credential column; omission preserves the current value.
      await this.updateAuthData({ clientInfo: null });
      this.initialized = false;
      this.currentOAuthState = "";
      // oxlint-disable-next-line eslint/no-undefined -- Discard the cached session after invalidation or redirect reconciliation so a later read reloads or initializes it.
      this.cachedAuthData = undefined;
      // Clear the PKCE verifier - this invalidates any pending authorization
    } else if (scope === "verifier") {
      // Clear cached authorization URL since it's tied to the old verifier
      // oxlint-disable-next-line unicorn/no-null -- Explicit null clears this stored OAuth credential column; omission preserves the current value.
      await this.updateAuthData({ codeVerifier: null });
      // oxlint-disable-next-line unicorn/no-null -- Null marks an idle coalesced promise or absent cached authorization URL; preserve this existing cache-state sentinel rather than exchanging it for an undefined convention exception.
      this.cachedAuthorizationUrl = null;
    }
  }
  /* oxlint-enable eslint/max-statements */
  /* oxlint-enable oxc/no-async-await */
}
/* oxlint-enable import/prefer-default-export, import/no-named-export */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
