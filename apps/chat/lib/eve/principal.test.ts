import { beforeEach, expect, test, vi } from "vitest";

import { POST } from "../../app/api/eve-guest/route";
import { createEveGuestCredential, eveGuestOwnerId } from "./guest-credential";
import { EVE_GUEST_COOKIE, resolveEvePrincipal } from "./principal";

const mocks = vi.hoisted(() => ({
  credential: vi.fn(),
  enabled: true,
  env: { APP_URL: "http://localhost:3790", NODE_ENV: "development" },
  session: vi.fn(),
}));
vi.mock("../auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("../db/eve-guests", () => ({
  readEveGuestCredential: mocks.credential,
}));
vi.mock("../env", () => ({ env: mocks.env }));
vi.mock("./availability", () => ({ isEveEnabled: () => mocks.enabled }));
vi.mock("../types/anonymous", () => ({
  ANONYMOUS_LIMITS: { SESSION_DURATION: 2_147_483_647 },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.credential.mockResolvedValue({ status: "missing" });
  mocks.enabled = true;
  mocks.env.NODE_ENV = "development";
});

test("a guest has a stable pending scope without a database account or BetterAuth identity", async () => {
  const credential = createEveGuestCredential();
  const headers = new Headers({
    cookie: `${EVE_GUEST_COOKIE}=${credential.token}`,
  });
  expect(await resolveEvePrincipal(headers)).toEqual({
    kind: "guest",
    ownerId: eveGuestOwnerId(credential.tokenHash),
    state: "pending",
    tokenHash: credential.tokenHash,
  });
  expect(mocks.credential).toHaveBeenCalledWith(credential.tokenHash);
});

test("registered login wins without transferring the guest identity or history", async () => {
  mocks.session.mockResolvedValue({ user: { id: "registered-owner" } });
  expect(
    await resolveEvePrincipal(
      new Headers({
        cookie: `${EVE_GUEST_COOKIE}=${createEveGuestCredential().token}`,
      })
    )
  ).toEqual({ kind: "registered", ownerId: "registered-owner" });
  expect(mocks.credential).not.toHaveBeenCalled();
});

test("legacy, malformed and duplicate guest cookies cannot select an owner", async () => {
  const { token } = createEveGuestCredential();
  for (const cookie of [
    `anonymous-session=${JSON.stringify({
      id: "victim",
      remainingCredits: 9999,
    })}`,
    `${EVE_GUEST_COOKIE}=victim`,
    `${EVE_GUEST_COOKIE}=${token}; ${EVE_GUEST_COOKIE}=${token}`,
  ]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each case completes before the shared fixture or mock state is reused.
    expect(await resolveEvePrincipal(new Headers({ cookie }))).toBeNull();
  }
  expect(mocks.credential).not.toHaveBeenCalled();
});

test("expired credentials cannot become pending guests and mismatched bindings fail closed", async () => {
  const credential = createEveGuestCredential();
  const headers = new Headers({
    cookie: `${EVE_GUEST_COOKIE}=${credential.token}`,
  });
  mocks.credential.mockResolvedValue({ status: "expired" });
  expect(await resolveEvePrincipal(headers)).toBeNull();
  mocks.credential.mockResolvedValue({
    guest: { ownerId: "victim", remainingMessages: 10 },
    status: "active",
  });
  expect(await resolveEvePrincipal(headers)).toBeNull();
  mocks.credential.mockResolvedValue({
    guest: {
      ownerId: eveGuestOwnerId(credential.tokenHash),
      remainingMessages: 3,
    },
    status: "active",
  });
  expect(await resolveEvePrincipal(headers)).toMatchObject({
    kind: "guest",
    remainingMessages: 3,
    state: "active",
  });
});

test("bootstrap rejects cross-origin requests before authentication and remains feature gated", async () => {
  const rejected = await POST(
    new Request("http://localhost:3790/api/eve-guest", {
      headers: { origin: "https://other.invalid" },
      method: "POST",
    })
  );
  expect(rejected.status).toBe(403);
  expect(mocks.session).not.toHaveBeenCalled();
  mocks.enabled = false;
  const disabled = await POST(
    new Request("http://localhost:3790/api/eve-guest", {
      headers: { origin: "http://localhost:3790" },
      method: "POST",
    })
  );
  expect(disabled.status).toBe(404);
  expect(disabled.headers.has("set-cookie")).toBe(false);
});

test("bootstrap keeps its secret in an HttpOnly cookie and does not rotate a valid credential", async () => {
  mocks.env.NODE_ENV = "production";
  const response = await POST(
    new Request("http://localhost:3790/api/eve-guest", {
      headers: { origin: "http://localhost:3790" },
      method: "POST",
    })
  );
  const cookie = response.headers.get("set-cookie") ?? "";
  expect(cookie).toContain("; HttpOnly; SameSite=Lax; Max-Age=2147483; Secure");
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = await response.json();
  expect(Object.keys(body).toSorted()).toEqual(["kind", "ownerId"]);
  const repeated = await POST(
    new Request("http://localhost:3790/api/eve-guest", {
      headers: {
        cookie: cookie.split(";")[0],
        origin: "http://localhost:3790",
      },
      method: "POST",
    })
  );
  expect(await repeated.json()).toEqual(body);
  expect(repeated.headers.has("set-cookie")).toBe(false);
});
