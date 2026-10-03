import { createMCPClient } from "@ai-sdk/mcp";
import type { OAuthClientProvider, OAuthTokens } from "@ai-sdk/mcp";
import { expect, test } from "vitest";

const serverUrl = "https://mcp.test/";
const endpointUrl = `${serverUrl}messages`;
const authorizationServerUrl = "https://auth.test/";
const tokenEndpoint = `${authorizationServerUrl}token`;

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * init-declarations (#507): test.each([{ timing: "simultaneous" }, { timing: "after-save" }])("SSE $timing 401 re assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): test.each([{ timing: "simultaneous" }, { timing: "after-save" }])("SSE $timing 401 re keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test.each([{ timing: "simultaneous" }, { timing: "after-save" }])("SSE $timing 401 re keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test.each([{ timing: "simultaneous" }, { timing: "after-save" }])("SSE $timing 401 re uses 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test.each([{ timing: "simultaneous" }, { timing: "after-save" }])("SSE $timing 401 re uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): test.each([{ timing: "simultaneous" }, { timing: "after-save" }])("SSE $timing 401 re accepts { timing }; input: string | URL | Request; init?: RequestInit; controller; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): test.each([{ timing: "simultaneous" }, { timing: "after-save" }])("SSE $timing 401 re preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test.each([{ timing: "simultaneous" }, { timing: "after-save" }])(
  "SSE $timing 401 responses share one complete OAuth refresh",
  async ({ timing }) => {
    let streamController:
      | ReadableStreamDefaultController<Uint8Array>
      | undefined;
    let tokens: OAuthTokens = {
      access_token: "access-old",
      authorization_server: authorizationServerUrl,
      issuer: authorizationServerUrl,
      refresh_token: "refresh-stable",
      token_endpoint: tokenEndpoint,
      token_type: "Bearer",
    };
    let validAccessToken = tokens.access_token;
    let refreshes = 0;
    let oldTokenRequests = 0;
    const firstRefreshSaved = Promise.withResolvers<undefined>();
    const bothOldTokenRequestsStarted = Promise.withResolvers<undefined>();
    const encoder = new TextEncoder();

    const provider: OAuthClientProvider = {
      clientInformation: () => ({ client_id: "client" }),
      clientMetadata: { redirect_uris: ["https://app.test/oauth/callback"] },
      codeVerifier: (): string => "verifier",
      redirectToAuthorization: (): void => {
        // This fixture never enters the authorization redirect flow.
      },
      redirectUrl: "https://app.test/oauth/callback",
      saveCodeVerifier: (): void => {
        // This fixture already has a code verifier.
      },
      saveTokens: (nextTokens): void => {
        tokens = nextTokens;
        firstRefreshSaved.resolve(undefined);
      },
      tokens: () => tokens,
    };

    const fakeFetch = async (
      input: string | URL | Request,
      init?: RequestInit
    ): Promise<Response> => {
      const request = new Request(input, init);

      if (request.url === serverUrl && request.method === "GET") {
        const stream = new ReadableStream<Uint8Array>({
          start(controller): void {
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
          authorization_servers: [authorizationServerUrl],
          resource: serverUrl,
        });
      }

      if (
        request.url ===
        `${authorizationServerUrl}.well-known/oauth-authorization-server`
      ) {
        return Response.json({
          authorization_endpoint: `${authorizationServerUrl}authorize`,
          grant_types_supported: ["refresh_token"],
          issuer: authorizationServerUrl,
          response_types_supported: ["code"],
          token_endpoint: tokenEndpoint,
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
            bothOldTokenRequestsStarted.resolve(undefined);
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
                id: message.id,
                jsonrpc: "2.0",
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
      initialInitializeResult: {
        capabilities: { resources: {} },
        protocolVersion: "2024-11-05",
        serverInfo: { name: "fake", version: "1" },
      },
      transport: {
        authProvider: provider,
        fetch: fakeFetch,
        type: "sse",
        url: serverUrl,
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
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null */
