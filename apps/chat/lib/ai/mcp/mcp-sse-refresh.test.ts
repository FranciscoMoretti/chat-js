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

test.each([
  { timing: "simultaneous" },
  { timing: "after-save" },
])("SSE $timing 401 responses share one complete OAuth refresh", async ({
  timing,
}) => {
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
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
});
