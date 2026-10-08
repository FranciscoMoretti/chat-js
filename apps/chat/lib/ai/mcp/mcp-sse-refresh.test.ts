import type { OAuthClientProvider, OAuthTokens } from "@ai-sdk/mcp";
import { expect, test } from "vitest";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { createMCPClient } from "@ai-sdk/mcp";

const serverUrl = "https://mcp.test/";
const endpointUrl = `${serverUrl}messages`;
const authorizationServerUrl = "https://auth.test/";
const tokenEndpoint = `${authorizationServerUrl}token`;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([{ timing: "simultaneous" }, { timing: "after-save" }])'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, unicorn/no-null --
 * init-declarations: The SSE controller is unavailable until the transport invokes stream.start; initialize it through that actual native callback.
 * max-lines-per-function, max-statements: This native SDK integration fixture serves SSE, resource discovery, authorization discovery, token refresh and resource requests against shared token state. The two barriers distinguish overlapping 401s from a 401 arriving after token persistence, and client.close remains in finally.
 * no-magic-numbers: Counters and expectations distinguish the first refresh and two old-token requests; these are independent scenario assertions.
 * no-undefined: Completion barriers resolve with undefined without adding a payload or changing their Promise types.
 * unicorn/no-null: Bodyless HTTP responses use the native null sentinel; parsed JSON may also contain null and must be excluded before testing its request ID.
 */
test.each([{ timing: "simultaneous" }, { timing: "after-save" }])(
  "SSE $timing 401 responses share one complete OAuth refresh",
  async ({ timing }: Readonly<{ timing: string }>) => {
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
      input: string | ReadonlyNativeSurface<URL | Request>,

      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the original RequestInit to new Request; recursively readonly headers contain readonly tuples that its native HeadersInit rejects.
      init?: Readonly<RequestInit>
    ): Promise<Response> => {
      const request = new Request(input, init);

      if (request.url === serverUrl && request.method === "GET") {
        const stream = new ReadableStream<Uint8Array>({
          start(
            controller: Readonly<ReadableStreamDefaultController<Uint8Array>>
          ): void {
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
          // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading enqueue from streamController; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, unicorn/no-null */
