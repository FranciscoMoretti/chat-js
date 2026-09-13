import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

import { proxy } from "./proxy";

const mocks = vi.hoisted(() => ({ session: vi.fn(), eveEnabled: true }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/lib/config", () => ({ config: { desktopApp: { enabled: false } } }));
vi.mock("@/lib/constants", () => ({ isPlaywrightTestEnvironment: false }));
vi.mock("@/lib/eve/availability", () => ({
  isEveEnabled: () => mocks.eveEnabled,
}));

beforeEach(() => {
  mocks.session.mockResolvedValue(null);
  mocks.eveEnabled = true;
});

it("lets guest EVE conversations reach page-level ownership checks", async () => {
  expect(
    await proxy(new NextRequest("http://localhost/chat/guest-conversation"))
  ).toBeUndefined();
});

it("keeps registered-only pages and disabled EVE routes behind login", async () => {
  for (const path of ["/project/private", "/chat/private/settings"]) {
    expect(
      (await proxy(new NextRequest(`http://localhost${path}`)))?.headers.get(
        "location"
      )
    ).toBe("http://localhost/login");
  }
  mocks.eveEnabled = false;
  expect(
    (
      await proxy(new NextRequest("http://localhost/chat/guest-conversation"))
    )?.headers.get("location")
  ).toBe("http://localhost/login");
});
