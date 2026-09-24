import { afterEach, expect, test } from "bun:test";

import { checkHealth } from "./dev-health";

const servers: ReturnType<typeof Bun.serve>[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) {
    server.stop(true);
  }
});
const fixture = (
  auth: () => Response,
  health = () => Response.json({ status: "ready" })
) => {
  const server = Bun.serve({
    fetch(request) {
      return new URL(request.url).pathname === "/api/health"
        ? health()
        : auth();
    },
    hostname: "127.0.0.1",
    port: 0,
  });
  servers.push(server);
  return server.url.origin;
};

test("requires the app health endpoint and a working unauthenticated auth route", async () => {
  await expect(
    checkHealth(fixture(() => Response.json(null)))
  ).resolves.toBeUndefined();
});

test("rejects healthy infrastructure when dynamic auth routing returns a 404", async () => {
  await expect(
    checkHealth(fixture(() => new Response("Not found", { status: 404 })))
  ).rejects.toThrow("Authentication route returned HTTP 404");
});

test("rejects HTML, redirects and unexpected sessions instead of reporting ready", async () => {
  for (const auth of [
    () => new Response("<html>Not found</html>"),
    () => Response.redirect("http://127.0.0.1/login"),
    () => Response.json({ user: { id: "unexpected" } }),
  ]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for each bounded stream read, readiness attempt, or shared fixture before continuing.
    await expect(checkHealth(fixture(auth))).rejects.toThrow();
  }
});

test("still rejects unavailable infrastructure even when authentication routing works", async () => {
  await expect(
    checkHealth(
      fixture(
        () => Response.json(null),
        () => Response.json({ status: "unavailable" }, { status: 503 })
      )
    )
  ).rejects.toThrow("Readiness returned HTTP 503");
});
