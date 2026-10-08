import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "./proxy";

const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/lib/config", () => ({ config: { desktopApp: { enabled: false } } }));
vi.mock("@/lib/constants", () => ({ isPlaywrightTestEnvironment: false }));

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): beforeEach preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
beforeEach(() => {
  mocks.session.mockClear();
  mocks.session.mockResolvedValue(null);
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/no-null */

it("lets guest EVE conversations reach page-level ownership checks", async () => {
  expect(
    await proxy(new NextRequest("http://localhost/chat/guest-conversation"))
  ).toBeUndefined();
});

it.each([
  "/eve/stream",
  "/api/auth/session",
  "/robots.txt",
  "/manifest.webmanifest",
])("passes through %s before session lookup", async (pathname) => {
  const response = await proxy(new NextRequest(`http://localhost${pathname}`));
  expect(response).toBeUndefined();
  expect(mocks.session).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("keeps registered-only pages behind login", async () => {
  for (const path of ["/project/private", "/chat/private/settings"]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for each bounded stream read, readiness attempt, or shared fixture before continuing.
    const resolvedResult1 = await proxy(
      new NextRequest(`http://localhost${path}`)
    );
    if (!resolvedResult1) {
      throw new Error("Expected a protected page login redirect");
    }
    expect(resolvedResult1.headers.get("location")).toBe(
      "http://localhost/login"
    );
  }
});
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- These request-contract tests await the native asynchronous session lookup before inspecting its redirect. */
it("keeps native headers and searchParams receiver through an authenticated redirect", async () => {
  mocks.session.mockResolvedValue({ user: { id: "registered-user" } });
  const request = new NextRequest(
    "http://localhost/login?returnTo=%2Fchat%2Fconversation"
  );
  const { searchParams } = request.nextUrl;
  const get = vi.spyOn(searchParams, "get");
  const response = await proxy(request);

  expect(mocks.session).toHaveBeenCalledWith({ headers: request.headers });
  expect(get.mock.contexts).toEqual([searchParams]);
  if (!response) {
    throw new Error("Expected an authenticated login redirect");
  }
  expect(response.headers.get("location")).toBe(
    "http://localhost/chat/conversation"
  );
});

it.each(["", "//external.example/path", "https://external.example/path"])(
  "rejects unsafe returnTo %s",
  async (returnTo) => {
    mocks.session.mockResolvedValue({ user: { id: "registered-user" } });
    const request = new NextRequest(
      `http://localhost/login?returnTo=${encodeURIComponent(returnTo)}`
    );
    const response = await proxy(request);
    if (!response) {
      throw new Error("Expected an authenticated login redirect");
    }
    expect(response.headers.get("location")).toBe("http://localhost/");
  }
);
/* oxlint-enable oxc/no-async-await */
