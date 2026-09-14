# Draft: MCP SSE transport refreshes OAuth credentials more than once for concurrent 401 responses

**Status:** unpublished; user review required before posting to vercel/ai.

## Problem

With `@ai-sdk/mcp` 2.0.45, two concurrent requests on one connected SSE transport can independently run OAuth recovery. A provider that retains its refresh token but replaces the valid access token on each refresh receives two refresh requests. Depending on response timing, the first caller can retry with a token invalidated by the second refresh.

A late 401 from a request sent with the previous access token can also start another refresh after the first recovery has already saved new credentials.

## Environment

- `@ai-sdk/mcp`: 2.0.45
- Node.js: 24.20.0
- Vitest: 4.1.4
- Transport: legacy SSE
- Reproduction uses an in-memory fetch implementation; no external service, credentials, database, or model calls are required.

## Expected and actual behavior

Both resource requests should succeed after one refresh. The regression below has two cases: simultaneous 401s and a second 401 delivered after the first token save.

On the original installed package, both cases fail the refresh-count assertion: expected 1, received 2. Both pass with the proposed patch. The fixture demonstrates redundant refreshes deterministically; it does not claim that every provider/timing combination fails the resource request.

## Proposed fix

Mirror the HTTP transport's per-transport `authPromise` coordination in `SseMCPTransport`, retaining the shared promise through the complete `auth()` call including `saveTokens()`, and clearing it in `finally`.

Before starting OAuth recovery for a 401, compare the bearer token actually sent with the provider's current token. If it has changed, retry once with the current token instead of refreshing again. If it is unchanged, run the normal authorization flow. Apply this to both stream establishment and message POSTs.

The maintained local patch updates source and the distributed runtime bundle. It is registered in Bun and included in generated ChatJS applications. This report concerns the SDK's per-transport coordination; application-level coordination across separate clients remains a separate responsibility.

## Minimal reproduction

Save the following as a Vitest test with the package versions above and run `vitest run`:

```ts
import {
  createMCPClient,
  type OAuthClientProvider,
  type OAuthTokens,
} from "@ai-sdk/mcp";
import { expect, test } from "vitest";

const serverUrl = "https://mcp.test/";
const endpointUrl = `${serverUrl}messages`;
const authorizationServerUrl = "https://auth.test/";
const tokenEndpoint = `${authorizationServerUrl}token`;

test.each([{ timing: "simultaneous" }, { timing: "after-save" }])(
  "SSE $timing 401 responses share one complete OAuth refresh",
  async ({ timing }) => {
    let streamController:
      ReadableStreamDefaultController<Uint8Array> | undefined;
    let tokens: OAuthTokens = {
      access_token: "access-old",
      refresh_token: "refresh-stable",
      token_type: "Bearer",
      issuer: authorizationServerUrl,
      authorization_server: authorizationServerUrl,
      token_endpoint: tokenEndpoint,
    };
    let validAccessToken = tokens.access_token;
    let refreshes = 0;
    let oldTokenRequests = 0;
    const firstRefreshSaved = Promise.withResolvers<void>();
    const bothOldTokenRequestsStarted = Promise.withResolvers<void>();
    const encoder = new TextEncoder();

    const provider: OAuthClientProvider = {
      tokens: () => tokens,
      saveTokens: (nextTokens) => {
        tokens = nextTokens;
        firstRefreshSaved.resolve();
      },
      redirectToAuthorization: () => undefined,
      saveCodeVerifier: () => undefined,
      codeVerifier: () => "verifier",
      redirectUrl: "https://app.test/oauth/callback",
      clientMetadata: { redirect_uris: ["https://app.test/oauth/callback"] },
      clientInformation: () => ({ client_id: "client" }),
    };

    const fakeFetch = async (
      input: string | URL | Request,
      init?: RequestInit
    ): Promise<Response> => {
      const request = new Request(input, init);

      if (request.url === serverUrl && request.method === "GET") {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            streamController = controller;
            controller.enqueue(
              encoder.encode(`event: endpoint\ndata: ${endpointUrl}\n\n`)
            );
          },
        });
        return new Response(stream, {
          headers: { "content-type": "text/event-stream" },
        });
      }

      if (request.url.endsWith("/.well-known/oauth-protected-resource")) {
        return Response.json({
          resource: serverUrl,
          authorization_servers: [authorizationServerUrl],
        });
      }

      if (
        request.url ===
        `${authorizationServerUrl}.well-known/oauth-authorization-server`
      ) {
        return Response.json({
          issuer: authorizationServerUrl,
          authorization_endpoint: `${authorizationServerUrl}authorize`,
          token_endpoint: tokenEndpoint,
          response_types_supported: ["code"],
          grant_types_supported: ["refresh_token"],
          token_endpoint_auth_methods_supported: ["none"],
        });
      }

      if (request.url === tokenEndpoint && request.method === "POST") {
        if (timing === "simultaneous") {
          await bothOldTokenRequestsStarted.promise;
        }
        refreshes += 1;
        validAccessToken = `access-${refreshes}`;
        return Response.json({
          access_token: validAccessToken,
          refresh_token: "refresh-stable",
          token_type: "Bearer",
        });
      }

      if (request.url === endpointUrl && request.method === "POST") {
        const authorization = request.headers.get("authorization");
        if (authorization !== `Bearer ${validAccessToken}`) {
          oldTokenRequests += 1;
          if (oldTokenRequests >= 2) {
            bothOldTokenRequestsStarted.resolve();
          }
          if (timing === "after-save" && oldTokenRequests === 2) {
            await firstRefreshSaved.promise;
          }
          return new Response(null, { status: 401 });
        }

        const message: unknown = await request.json();
        if (
          typeof message === "object" &&
          message !== null &&
          "id" in message &&
          (typeof message.id === "string" || typeof message.id === "number")
        ) {
          streamController?.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                jsonrpc: "2.0",
                id: message.id,
                result: { resources: [] },
              })}\n\n`
            )
          );
        }
        return new Response(null, { status: 202 });
      }

      return new Response(null, { status: 404 });
    };

    const client = await createMCPClient({
      transport: {
        type: "sse",
        url: serverUrl,
        authProvider: provider,
        fetch: fakeFetch,
      },
      initialInitializeResult: {
        protocolVersion: "2024-11-05",
        capabilities: { resources: {} },
        serverInfo: { name: "fake", version: "1" },
      },
    });
    validAccessToken = "access-invalidated";

    try {
      const results = await Promise.all([
        client.listResources(),
        client.listResources(),
      ]);
      expect(results).toEqual([{ resources: [] }, { resources: [] }]);
      expect(refreshes).toBe(1);
    } finally {
      await client.close();
    }
  }
);
```
