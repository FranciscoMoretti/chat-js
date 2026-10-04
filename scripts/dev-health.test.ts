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
  for (const server of servers.splice(FIRST_SERVER_INDEX)) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Finish stopping each test server before the next test starts.
    await server.stop(true);
  }
});
const fixture = (
  auth: () => ReadonlyNativeSurface<Response>,
  health: () => ReadonlyNativeSurface<Response> = () =>
    Response.json({ status: "ready" })
): string => {
  const server = Bun.serve({
    fetch(request: ReadonlyNativeSurface<Request>) {
      return new URL(request.url).pathname === "/api/health"
        ? health()
        : auth();
    },
    hostname: "127.0.0.1",
    port: OS_ASSIGNED_PORT,
  });
  servers.push(server);
  return server.url.origin;
};

/* oxlint-disable unicorn/no-null -- requires the app health endpoint and a working unauthenticated auth route: The fixture explicitly exercises the null state required by the API. */
test("requires the app health endpoint and a working unauthenticated auth route", async (): Promise<void> => {
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Bun promise matchers must be awaited even though their declarations expose a void return.
  await expect(
    checkHealth(fixture(() => Response.json(null)))
  ).resolves.toBeUndefined();
});
/* oxlint-enable unicorn/no-null */

test("rejects healthy infrastructure when dynamic auth routing returns a 404", async (): Promise<void> => {
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Bun promise matchers must be awaited even though their declarations expose a void return.
  await expect(
    checkHealth(fixture(() => new Response("Not found", { status: 404 })))
  ).rejects.toThrow("Authentication route returned HTTP 404");
});

test("rejects HTML, redirects and unexpected sessions instead of reporting ready", async (): Promise<void> => {
  for (const auth of [
    () => new Response("<html>Not found</html>"),
    () => Response.redirect("http://127.0.0.1/login"),
    () => Response.json({ user: { id: "unexpected" } }),
  ]) {
    // oxlint-disable-next-line eslint/no-await-in-loop, typescript/await-thenable, typescript/no-confusing-void-expression -- Await each Bun promise matcher before reusing the fixture; matcher declarations expose a void return.
    await expect(checkHealth(fixture(auth))).rejects.toThrow();
  }
});

/* oxlint-disable unicorn/no-null -- still rejects unavailable infrastructure even when authentication routing works: The fixture explicitly exercises the null state required by the API. */
test("still rejects unavailable infrastructure even when authentication routing works", async (): Promise<void> => {
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Bun promise matchers must be awaited even though their declarations expose a void return.
  await expect(
    checkHealth(
      fixture(
        () => Response.json(null),
        () => Response.json({ status: "unavailable" }, { status: 503 })
      )
    )
  ).rejects.toThrow("Readiness returned HTTP 503");
});
/* oxlint-enable unicorn/no-null */
