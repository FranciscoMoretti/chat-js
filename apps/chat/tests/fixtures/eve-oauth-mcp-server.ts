/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import { createHash, randomUUID } from "node:crypto";; import { createServer } from "node:http";; import type { IncomingMessage, ServerResponse } from "node:http";; its Node runtime boundary deliberately permits these built-ins.
 */
/* oxlint-disable eslint/no-promise-executor-return -- These Promise executors directly register callback APIs whose return values are ignored. */
/* oxlint-disable eslint/no-shadow -- Nested callback names mirror the protocol fields and transaction APIs under test. */
/* oxlint-disable promise/avoid-new -- These fixtures adapt callback, timer, stream, or browser event APIs into awaited Promises. */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { IncomingMessage, ServerResponse } from "node:http";
/* oxlint-enable sort-imports */

import { z } from "zod";
/* oxlint-enable import/no-nodejs-modules */

const BEARER_PREFIX = /^Bearer /u;
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): registrationInput uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
const registrationInput = z.object({ redirect_uris: z.array(z.url()).min(1) });
/* oxlint-enable no-magic-numbers */
const rpcInput = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.object({ name: z.string().optional() }).loose().optional(),
});

const eveOAuthMcpTokenResultMarker = "EVE_OAUTH_MCP_TOKEN";

interface EveOAuthMcpServer {
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
}

interface RegisteredClient {
  redirectUris: string[];
}

interface AuthorizationCode {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  used: boolean;
}

interface RefreshGrant {
  clientId: string;
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * typescript/prefer-readonly-parameter-types (#565): readBody accepts request: IncomingMessage; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): readBody preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
function readBody(request: IncomingMessage): Promise<string> {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): sendJson accepts response: ServerResponse; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown
): void {
  response
    .writeHead(status, { "content-type": "application/json" })
    .end(JSON.stringify(value));
}
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (startEveOAuthMcpServer); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve startEveOAuthMcpServer's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return --
 * jsdoc/require-returns (#535): startEveOAuthMcpServer's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): startEveOAuthMcpServer keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): startEveOAuthMcpServer keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): startEveOAuthMcpServer uses 401, 200, 201, 400, 302, 50, 202, 404 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): startEveOAuthMcpServer uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep startEveOAuthMcpServer's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): startEveOAuthMcpServer accepts response: ServerResponse; request: IncomingMessage; url: URL; params: URLSearchParams; error; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): startEveOAuthMcpServer intentionally keeps the existing falsy-value behavior of client?.redirectUris.includes(redirectUri); valid; token; address; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * typescript/strict-void-return (#611): startEveOAuthMcpServer's void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
 */
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

  function reject(response: ServerResponse): void {
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

  function sendProtectedResourceMetadata(response: ServerResponse): void {
    sendJson(response, 200, {
      authorization_servers: [origin],
      resource: `${origin}/mcp`,
      scopes_supported: ["mcp:tools"],
    });
  }

  function sendAuthorizationServerMetadata(response: ServerResponse): void {
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
  ): Promise<void> {
    const body = registrationInput.parse(JSON.parse(await readBody(request)));
    const clientId = `client_${randomUUID()}`;
    clients.set(clientId, { redirectUris: body.redirect_uris });
    counters.registrations += 1;
    sendJson(response, 201, {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing body own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...body,
      client_id: clientId,
      token_endpoint_auth_method: "none",
    });
  }

  function authorize(url: URL, response: ServerResponse): void {
    const clientId = url.searchParams.get("client_id") ?? "";
    const redirectUri = url.searchParams.get("redirect_uri") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const codeChallenge = url.searchParams.get("code_challenge") ?? "";
    const client = clients.get(clientId);
    const valid =
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading redirectUris from client; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      client?.redirectUris.includes(redirectUri) &&
      state &&
      url.searchParams.get("response_type") === "code" &&
      url.searchParams.get("code_challenge_method") === "S256" &&
      codeChallenge &&
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading split from url.searchParams.get(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
  ): void {
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
  ): void {
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
  ): Promise<void> {
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
  ): void {
    sendJson(response, 200, { id, jsonrpc: "2.0", result });
  }

  async function handleMcp(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading replace from request.headers.authorization; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading name from rpc.params; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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

  async function route(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
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

  // oxlint-disable-next-line typescript/no-misused-promises -- The async fixture route handles failures internally and writes an HTTP response; Node intentionally ignores the handler return value.
  const server = createServer(route);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("OAuth MCP fixture did not receive a loopback address.");
  }
  origin = `http://127.0.0.1:${address.port}`;
  return {
    async close(): Promise<void> {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    },
    counters,
    invalidateAccessTokens(): void {
      accessTokens.clear();
    },
    mcpUrl: `${origin}/mcp`,
    origin,
    tokenResult: eveOAuthMcpTokenResultMarker,
  };
}
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return */

/* oxlint-disable max-lines -- #509: This eve-oauth-mcp-server.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
