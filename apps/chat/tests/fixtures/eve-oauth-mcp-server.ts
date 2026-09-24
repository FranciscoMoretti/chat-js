/* oxlint-disable eslint/no-promise-executor-return -- These Promise executors directly register callback APIs whose return values are ignored. */
/* oxlint-disable eslint/no-shadow -- Nested callback names mirror the protocol fields and transaction APIs under test. */
/* oxlint-disable promise/avoid-new -- These fixtures adapt callback, timer, stream, or browser event APIs into awaited Promises. */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

import { z } from "zod";

const BEARER_PREFIX = /^Bearer /u;
const registrationInput = z.object({ redirect_uris: z.array(z.url()).min(1) });
const rpcInput = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.object({ name: z.string().optional() }).passthrough().optional(),
});

const eveOAuthMcpTokenResultMarker = "EVE_OAUTH_MCP_TOKEN";

type EveOAuthMcpServer = {
  origin: string;
  mcpUrl: string;
  tokenResult: string;
  close: () => Promise<void>;
  invalidateAccessTokens: () => void;
  counters: {
    registrations: number;
    authorizations: number;
    tokenExchanges: number;
    refreshes: number;
    toolCalls: number;
    authenticatedInitializations: number;
  };
};

type RegisteredClient = {
  redirectUris: string[];
};

type AuthorizationCode = {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  used: boolean;
};

type RefreshGrant = {
  clientId: string;
};

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";
    request.setEncoding("utf-8");
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response
    .writeHead(status, { "content-type": "application/json" })
    .end(JSON.stringify(value));
}

/**
 * Starts an OAuth-protected Streamable HTTP MCP server for local Eve tests.
 * The authorization endpoint immediately redirects to the registered callback.
 */
export async function startEveOAuthMcpServer(): Promise<EveOAuthMcpServer> {
  const clients = new Map<string, RegisteredClient>();
  const codes = new Map<string, AuthorizationCode>();
  const accessTokens = new Set<string>();
  const refreshTokens = new Map<string, RefreshGrant>();
  const counters = {
    authenticatedInitializations: 0,
    authorizations: 0,
    refreshes: 0,
    registrations: 0,
    tokenExchanges: 0,
    toolCalls: 0,
  };
  let origin = "";

  function reject(response: ServerResponse) {
    response
      .writeHead(401, {
        "www-authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
      })
      .end();
  }

  function issueTokens(clientId: string) {
    const accessToken = `access_${randomUUID()}`;
    const refreshToken = `refresh_${randomUUID()}`;
    accessTokens.add(accessToken);
    refreshTokens.set(refreshToken, { clientId });
    return {
      access_token: accessToken,
      expires_in: 60,
      refresh_token: refreshToken,
      token_type: "Bearer",
    };
  }

  function sendProtectedResourceMetadata(response: ServerResponse) {
    sendJson(response, 200, {
      authorization_servers: [origin],
      resource: `${origin}/mcp`,
      scopes_supported: ["mcp:tools"],
    });
  }

  function sendAuthorizationServerMetadata(response: ServerResponse) {
    sendJson(response, 200, {
      authorization_endpoint: `${origin}/authorize`,
      code_challenge_methods_supported: ["S256"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      issuer: origin,
      registration_endpoint: `${origin}/register`,
      response_types_supported: ["code"],
      token_endpoint: `${origin}/token`,
      token_endpoint_auth_methods_supported: ["none"],
    });
  }

  async function registerClient(
    request: IncomingMessage,
    response: ServerResponse
  ) {
    const body = registrationInput.parse(JSON.parse(await readBody(request)));
    const clientId = `client_${randomUUID()}`;
    clients.set(clientId, { redirectUris: body.redirect_uris });
    counters.registrations += 1;
    sendJson(response, 201, {
      ...body,
      client_id: clientId,
      token_endpoint_auth_method: "none",
    });
  }

  function authorize(url: URL, response: ServerResponse) {
    const clientId = url.searchParams.get("client_id") ?? "";
    const redirectUri = url.searchParams.get("redirect_uri") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const codeChallenge = url.searchParams.get("code_challenge") ?? "";
    const client = clients.get(clientId);
    const valid =
      client?.redirectUris.includes(redirectUri) &&
      state &&
      url.searchParams.get("response_type") === "code" &&
      url.searchParams.get("code_challenge_method") === "S256" &&
      codeChallenge &&
      url.searchParams.get("scope")?.split(" ").includes("mcp:tools");
    if (!valid) {
      sendJson(response, 400, { error: "invalid_authorization_request" });
      return;
    }
    const code = `code_${randomUUID()}`;
    codes.set(code, { clientId, codeChallenge, redirectUri, used: false });
    counters.authorizations += 1;
    const callback = new URL(redirectUri);
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", state);
    response.writeHead(302, { location: callback.toString() }).end();
  }

  function issueAuthorizationCodeTokens(
    params: URLSearchParams,
    clientId: string,
    response: ServerResponse
  ) {
    const code = codes.get(params.get("code") ?? "");
    const verifier = params.get("code_verifier") ?? "";
    const redirectUri = params.get("redirect_uri") ?? "";
    const valid =
      code &&
      !code.used &&
      code.clientId === clientId &&
      code.redirectUri === redirectUri &&
      code.codeChallenge === pkceChallenge(verifier);
    if (!valid) {
      sendJson(response, 400, { error: "invalid_grant" });
      return;
    }
    code.used = true;
    counters.tokenExchanges += 1;
    sendJson(response, 200, issueTokens(clientId));
  }

  function issueRefreshTokens(
    params: URLSearchParams,
    clientId: string,
    response: ServerResponse
  ) {
    const token = params.get("refresh_token") ?? "";
    const grant = refreshTokens.get(token);
    if (!grant || grant.clientId !== clientId) {
      sendJson(response, 400, { error: "invalid_grant" });
      return;
    }
    refreshTokens.delete(token);
    counters.refreshes += 1;
    sendJson(response, 200, issueTokens(clientId));
  }

  async function exchangeToken(
    request: IncomingMessage,
    response: ServerResponse
  ) {
    const params = new URLSearchParams(await readBody(request));
    const clientId = params.get("client_id") ?? "";
    if (!clients.has(clientId)) {
      sendJson(response, 401, { error: "invalid_client" });
      return;
    }
    if (params.get("grant_type") === "authorization_code") {
      issueAuthorizationCodeTokens(params, clientId, response);
      return;
    }
    if (params.get("grant_type") === "refresh_token") {
      // Let concurrent clients present the same old token before rotation completes.
      await new Promise((resolve) => setTimeout(resolve, 50));
      issueRefreshTokens(params, clientId, response);
      return;
    }
    sendJson(response, 400, { error: "unsupported_grant_type" });
  }

  function sendMcpResult(
    response: ServerResponse,
    id: string | number,
    result: unknown
  ) {
    sendJson(response, 200, { id, jsonrpc: "2.0", result });
  }

  async function handleMcp(request: IncomingMessage, response: ServerResponse) {
    const token = request.headers.authorization?.replace(BEARER_PREFIX, "");
    if (!(token && accessTokens.has(token))) {
      reject(response);
      return;
    }
    const rpc = rpcInput.parse(JSON.parse(await readBody(request)));
    if (rpc.id === undefined) {
      response.writeHead(202).end();
      return;
    }
    if (rpc.method === "initialize") {
      counters.authenticatedInitializations += 1;
      sendMcpResult(response, rpc.id, {
        capabilities: { tools: {} },
        protocolVersion: "2025-03-26",
        serverInfo: { name: "Eve OAuth MCP fixture", version: "1.0.0" },
      });
      return;
    }
    if (rpc.method === "tools/list") {
      sendMcpResult(response, rpc.id, {
        tools: [
          {
            description: "Return the fixture's public result marker.",
            inputSchema: {
              additionalProperties: false,
              properties: {},
              type: "object",
            },
            name: "read_token",
          },
        ],
      });
      return;
    }
    if (rpc.method === "tools/call" && rpc.params?.name === "read_token") {
      counters.toolCalls += 1;
      sendMcpResult(response, rpc.id, {
        content: [{ text: eveOAuthMcpTokenResultMarker, type: "text" }],
      });
      return;
    }
    sendJson(response, 200, {
      error: { code: -32_601, message: "Method not found" },
      id: rpc.id,
      jsonrpc: "2.0",
    });
  }

  async function route(request: IncomingMessage, response: ServerResponse) {
    try {
      const url = new URL(request.url ?? "/", origin);
      switch (`${request.method} ${url.pathname}`) {
        case "GET /.well-known/oauth-protected-resource/mcp": {
          sendProtectedResourceMetadata(response);
          return;
        }
        case "GET /.well-known/oauth-authorization-server": {
          sendAuthorizationServerMetadata(response);
          return;
        }
        case "POST /register": {
          await registerClient(request, response);
          return;
        }
        case "GET /authorize": {
          authorize(url, response);
          return;
        }
        case "POST /token": {
          await exchangeToken(request, response);
          return;
        }
        case "POST /mcp": {
          await handleMcp(request, response);
          return;
        }
        default: {
          response.writeHead(404).end();
        }
      }
    } catch {
      if (response.headersSent) {
        response.end();
      } else {
        sendJson(response, 400, { error: "invalid_request" });
      }
    }
  }

  const server = createServer(route);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("OAuth MCP fixture did not receive a loopback address.");
  }
  origin = `http://127.0.0.1:${address.port}`;
  return {
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    },
    counters,
    invalidateAccessTokens() {
      accessTokens.clear();
    },
    mcpUrl: `${origin}/mcp`,
    origin,
    tokenResult: eveOAuthMcpTokenResultMarker,
  };
}
