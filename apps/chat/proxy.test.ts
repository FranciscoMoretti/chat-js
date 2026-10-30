import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "./proxy";

const mocks = vi.hoisted(() => ({ session: vi.fn(), isAuthRoute: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/integrations/authentication", () => ({
  authentication: { isAuthRoute: mocks.isAuthRoute },
}));
vi.mock("@/lib/constants", () => ({ isPlaywrightTestEnvironment: false }));

beforeEach(() => {
  mocks.session.mockClear();
  mocks.isAuthRoute.mockReset().mockReturnValue(false);
  mocks.session.mockResolvedValue(null);
});

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
it.each(["/project/private", "/chat/private/settings"])(
  "keeps registered-only page %s behind login",
  async (path) => {
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
);

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

it.each([
  "/login?client_id=electron",
  "/register?client_id=electron",
  "/device-login",
])(
  "keeps installed auth route %s accessible to signed-in users",
  async (route) => {
    mocks.session.mockResolvedValue({ user: { id: "registered-user" } });
    mocks.isAuthRoute.mockReturnValue(true);
    const request = new NextRequest(`http://localhost${route}`);
    expect(await proxy(request)).toBeUndefined();
    expect(mocks.isAuthRoute).toHaveBeenCalledWith(request.nextUrl);
  }
);

it("protects an uninstalled device-login route", async () => {
  const response = await proxy(
    new NextRequest("http://localhost/device-login")
  );
  expect(response?.headers.get("location")).toBe("http://localhost/login");
});
