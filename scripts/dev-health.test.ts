import { rejects } from "node:assert/strict";
import { afterEach, expect, test } from "bun:test";

import { checkHealth } from "./dev-health";

type ReadonlyNativeSurface<Value> = Value extends (
  ...parameters: readonly never[]
) => unknown
  ? Value
  : Value extends object
    ? {
        readonly [Property in keyof Value]: ReadonlyNativeSurface<
          Value[Property]
        >;
      }
    : Value;

const servers: ReturnType<typeof Bun.serve>[] = [];
const OS_ASSIGNED_PORT = 0;
const FIRST_SERVER_INDEX = 0;
afterEach(async (): Promise<void> => {
  await Promise.all(
    servers.splice(FIRST_SERVER_INDEX).map(async (server) => {
      await server.stop(true);
    })
  );
});
const fixture = (
  auth: () => ReadonlyNativeSurface<Response>,
  health: () => ReadonlyNativeSurface<Response> = () =>
    Response.json({ status: "ready" })
): string => {
  const server = Bun.serve({
    fetch(request: ReadonlyNativeSurface<Request>) {
      if (new URL(request.url).pathname === "/api/health") {
        return health();
      }
      return auth();
    },
    hostname: "127.0.0.1",
    port: OS_ASSIGNED_PORT,
  });
  servers.push(server);
  return server.url.origin;
};

test("requires the app health endpoint and a working unauthenticated auth route", async (): Promise<void> => {
  const completion: Promise<unknown> = checkHealth(
    fixture(() => Response.json(null))
  );
  expect(await completion).toBeUndefined();
});

test("rejects healthy infrastructure when dynamic auth routing returns a 404", async (): Promise<void> => {
  await rejects(
    checkHealth(fixture(() => new Response("Not found", { status: 404 }))),
    (reason: unknown) => {
      expect(() => {
        throw reason;
      }).toThrow("Authentication route returned HTTP 404");
      return true;
    }
  );
});
test("rejects HTML, redirects and unexpected sessions instead of reporting ready", async (): Promise<void> => {
  await Promise.all(
    [
      () => new Response("<html>Not found</html>"),
      () => Response.redirect("http://127.0.0.1/login"),
      () => Response.json({ user: { id: "unexpected" } }),
    ].map(async (auth) => {
      await rejects(checkHealth(fixture(auth)), (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow();
        return true;
      });
    })
  );
});
test("still rejects unavailable infrastructure even when authentication routing works", async (): Promise<void> => {
  await rejects(
    checkHealth(
      fixture(
        () => Response.json(null),
        () => Response.json({ status: "unavailable" }, { status: 503 })
      )
    ),
    (reason: unknown) => {
      expect(() => {
        throw reason;
      }).toThrow("Readiness returned HTTP 503");
      return true;
    }
  );
});

test("external cancellation aborts both pending HTTP probes", async (): Promise<void> => {
  const cancellation = new AbortController();
  const requested = Promise.withResolvers<undefined>();
  const response = Promise.withResolvers<Response>();
  const BOTH_ENDPOINTS = 2;
  let requests = 0;
  const server = Bun.serve({
    async fetch() {
      requests += 1;
      if (requests === BOTH_ENDPOINTS) {
        requested.resolve();
      }
      return await response.promise;
    },
    hostname: "127.0.0.1",
    port: OS_ASSIGNED_PORT,
  });
  servers.push(server);
  try {
    const completion = checkHealth(server.url.origin, cancellation.signal);
    await requested.promise;
    cancellation.abort();
    await rejects(completion, { name: "AbortError" });
    expect(requests).toBe(BOTH_ENDPOINTS);
  } finally {
    response.resolve(Response.json(null));
  }
});
