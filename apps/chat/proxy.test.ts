import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

import { proxy } from "./proxy";

const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/lib/config", () => ({ config: { desktopApp: { enabled: false } } }));
vi.mock("@/lib/constants", () => ({ isPlaywrightTestEnvironment: false }));

beforeEach(() => {
  mocks.session.mockResolvedValue(null);
});

it("lets guest EVE conversations reach page-level ownership checks", async () => {
  expect(
    await proxy(new NextRequest("http://localhost/chat/guest-conversation"))
  ).toBeUndefined();
});

it("keeps registered-only pages behind login", async () => {
  for (const path of ["/project/private", "/chat/private/settings"]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for each bounded stream read, readiness attempt, or shared fixture before continuing.
    const resolvedResult1 = await proxy(
      new NextRequest(`http://localhost${path}`)
    );
    expect(resolvedResult1?.headers.get("location")).toBe(
      "http://localhost/login"
    );
  }
});
