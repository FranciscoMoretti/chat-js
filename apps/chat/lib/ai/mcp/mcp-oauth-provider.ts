import { randomUUID } from "node:crypto";

import type {
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthTokens,
} from "@ai-sdk/mcp";

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
import type { OAuthClientInformationFull } from "@/lib/db/mcp-queries";
import type { McpOAuthSession } from "@/lib/db/schema";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("mcp-oauth-provider");

/**
 * PostgreSQL-backed OAuth client provider for MCP.
 * Implements the OAuthClientProvider interface from the AI SDK.
 * Persists OAuth state, PKCE verifier, client info, and tokens to the database.
 */
export class McpOAuthClientProvider implements OAuthClientProvider {
  private currentOAuthState = "";
  private cachedAuthData: McpOAuthSession | undefined;
  private initialized = false;
  private saveCodeVerifierPromise: Promise<void> | null = null;
  private cachedAuthorizationUrl: URL | null = null;
  private readonly config: {
    mcpConnectorId: string;
    serverUrl: string;
    clientMetadata: OAuthClientMetadata;
    onRedirectToAuthorization: (authUrl: URL) => Promise<void>;
    // Optional: adopt existing state for callback reconciliation.
    state?: string;
  };
  private saveClientInformationPromise: Promise<void> | null = null;

  constructor(config: {
    mcpConnectorId: string;
    serverUrl: string;
    clientMetadata: OAuthClientMetadata;
    onRedirectToAuthorization: (authUrl: URL) => Promise<void>;
    // Optional: adopt existing state for callback reconciliation.
    state?: string;
  }) {
    this.config = config;
  }

  private initializationPromise: Promise<void> | null = null;

  private async initializeOAuth() {
    // Prevent concurrent initialization - return existing promise if in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
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

  private async doInitializeOAuth() {
    // If state was provided (e.g., from callback), adopt it
    if (this.config.state) {
      const session = await getSessionByState({ state: this.config.state });
      if (session && session.mcpConnectorId === this.config.mcpConnectorId) {
        this.currentOAuthState = session.state ?? "";
        this.cachedAuthData = session;
        this.initialized = true;
        return;
      }
    }

    // Check for existing authenticated session
    const authenticated = await getAuthenticatedSession({
      mcpConnectorId: this.config.mcpConnectorId,
    });
    if (authenticated) {
      this.currentOAuthState = authenticated.state ?? "";
      this.cachedAuthData = authenticated;
      this.initialized = true;
      return;
    }

    // Create new in-progress session
    this.currentOAuthState = randomUUID();
    this.cachedAuthData = await createOAuthSession({
      mcpConnectorId: this.config.mcpConnectorId,
      serverUrl: this.config.serverUrl,
      state: this.currentOAuthState,
    });
    this.initialized = true;
  }

  private async getAuthData() {
    await this.initializeOAuth();
    return this.cachedAuthData;
  }

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

  get redirectUrl(): string {
    return this.config.clientMetadata.redirect_uris[0];
  }

  get clientMetadata(): OAuthClientMetadata {
    return this.config.clientMetadata;
  }

  state(): string {
    return this.currentOAuthState;
  }

  async clientInformation(): Promise<OAuthClientInformationFull | undefined> {
    const authData = await this.getAuthData();
    if (authData?.clientInfo) {
      const clientInfo = authData.clientInfo as OAuthClientInformationFull;
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
        if (authData.state) {
          await deleteSessionByState({ state: authData.state });
        }
        this.cachedAuthData = undefined;
        this.initialized = false;
      } else {
        return clientInfo;
      }
    }
  }

  async saveClientInformation(
    clientCredentials: OAuthClientInformationFull
  ): Promise<void> {
    if (this.saveClientInformationPromise) {
      await this.saveClientInformationPromise;
      return;
    }

    // If we already have a client registered for this state, keep it stable.
    // Some OAuth servers treat authorization codes as bound to client_id.
    if (this.cachedAuthData?.clientInfo) {
      return;
    }

    // Optimistic set so subsequent calls in this instance skip.
    if (this.cachedAuthData) {
      this.cachedAuthData = {
        ...this.cachedAuthData,
        clientInfo: clientCredentials,
      };
    }

    this.saveClientInformationPromise = (async () => {
      try {
        const session = await setOAuthClientInfoOnceByState({
          clientInfo: clientCredentials,
          state: this.currentOAuthState,
        });
        this.cachedAuthData = session;
      } finally {
        this.saveClientInformationPromise = null;
      }
    })();
    await this.saveClientInformationPromise;
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const authData = await this.getAuthData();
    return authData?.tokens as OAuthTokens | undefined;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this.cachedAuthData = await saveTokensAndCleanup({
      mcpConnectorId: this.config.mcpConnectorId,
      state: this.currentOAuthState,
      tokens,
    });
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    authorizationUrl.searchParams.set("state", this.state());

    // If the SDK calls redirect twice, keep the first URL stable.
    // Otherwise the UI might open URL #1 while the DB ended up with verifier #2.
    if (this.cachedAuthorizationUrl) {
      await this.config.onRedirectToAuthorization(this.cachedAuthorizationUrl);
      return;
    }
    this.cachedAuthorizationUrl = new URL(authorizationUrl.toString());

    await this.config.onRedirectToAuthorization(authorizationUrl);
  }

  async saveCodeVerifier(pkceVerifier: string): Promise<void> {
    if (this.saveCodeVerifierPromise) {
      await this.saveCodeVerifierPromise;
      return;
    }

    // Only save verifier ONCE - the AI SDK calls this multiple times
    // but the code_challenge is generated from the FIRST verifier.
    // If we already have a verifier for this session, keep it.
    const existingVerifier = this.cachedAuthData?.codeVerifier;

    if (existingVerifier) {
      log.info(
        {
          existingVerifierPrefix: existingVerifier.slice(0, 10),
          newVerifierPrefix: pkceVerifier.slice(0, 10),
          state: this.currentOAuthState,
        },
        "saveCodeVerifier: SKIPPING - verifier already exists"
      );

      return;
    }

    log.info(
      {
        codeVerifierPrefix: pkceVerifier.slice(0, 10),
        state: this.currentOAuthState,
      },
      "saveCodeVerifier: saving first verifier"
    );

    // Optimistic in-memory set so a concurrent call in this instance will skip.
    if (this.cachedAuthData) {
      this.cachedAuthData = {
        ...this.cachedAuthData,
        codeVerifier: pkceVerifier,
      };
    }

    // Serialize and make the DB write immutable (DB-side also guards against overwrite).
    this.saveCodeVerifierPromise = (async () => {
      try {
        const session = await setOAuthCodeVerifierOnceByState({
          codeVerifier: pkceVerifier,
          state: this.currentOAuthState,
        });
        this.cachedAuthData = session;
      } finally {
        this.saveCodeVerifierPromise = null;
      }
    })();
    await this.saveCodeVerifierPromise;
  }

  async codeVerifier(): Promise<string> {
    const authData = await this.getAuthData();
    log.info(
      {
        codeVerifierPrefix: authData?.codeVerifier?.slice(0, 10),
        hasCodeVerifier: !!authData?.codeVerifier,
        state: this.currentOAuthState,
      },
      "codeVerifier called"
    );
    if (!authData?.codeVerifier) {
      throw new Error("OAuth code verifier not found");
    }
    return authData.codeVerifier;
  }

  /**
   * Adopt state from another instance (multi-instance support).
   * Used when the callback needs to reconcile with an existing session.
   */
  async adoptState(state: string): Promise<void> {
    if (!state) {
      log.warn("adoptState called with empty state");
      return;
    }

    // If already initialized with this exact state, skip DB lookup
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
    log.info(
      {
        hasClientInfo: !!session.clientInfo,
        hasCodeVerifier: !!session.codeVerifier,
        hasTokens: !!session.tokens,
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

  async invalidateCredentials(
    scope: "all" | "client" | "tokens" | "verifier"
  ): Promise<void> {
    if (scope === "all") {
      await deleteSessionByState({ state: this.currentOAuthState });
      this.cachedAuthData = undefined;
      this.initialized = false;
      this.currentOAuthState = "";
    } else if (scope === "tokens") {
      await this.updateAuthData({ tokens: null });
    } else if (scope === "client") {
      // Clear client credentials - this forces re-registration with the OAuth server
      await this.updateAuthData({ clientInfo: null });
      // Reset state since client info is foundational to the OAuth flow
      this.initialized = false;
      this.currentOAuthState = "";
      this.cachedAuthData = undefined;
    } else if (scope === "verifier") {
      // Clear the PKCE verifier - this invalidates any pending authorization
      await this.updateAuthData({ codeVerifier: null });
      // Clear cached authorization URL since it's tied to the old verifier
      this.cachedAuthorizationUrl = null;
    }
  }
}
