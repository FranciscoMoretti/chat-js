import { beforeEach, expect, test, vi } from "vitest";

import { authenticateDisposableGuest } from "./disposable-guest-auth";
import { issueGuestCredential, newGuestClaims } from "./disposable-guest";

const store = vi.hoisted(() => ({ read: vi.fn(), reserve: vi.fn() }));
vi.mock("../env", () => ({
  env: {
    EVE_GATEWAY_SECRET: "test-guest-signing-secret-at-least-32-characters",
  },
}));
vi.mock("../db/guest-runtime", () => ({
  readGuestRuntimePolicy: store.read,
  reserveGuestRuntimeMessage: store.reserve,
}));
const policy = () => ({
  modelId: "openai/gpt-5-nano",
  policyVersion: 1,
  state: "deleting",
  sessionId: "session-owned",
  credentialExpiresAt: new Date(0),
  expiresAt: new Date(0),
});
const request = () =>
  new Request("https://chat.example/eve/v1/session/session-owned/reset", {
    method: "POST",
    body: JSON.stringify({ reason: "Guest retention expired" }),
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${issueGuestCredential({ ...newGuestClaims("openai/gpt-5-nano"), sessionId: "session-owned", purpose: "cleanup" })}`,
    },
  });
beforeEach(() => {
  vi.clearAllMocks();
  store.read.mockResolvedValue(policy());
});

test("cleanup credential may retire expired guest policy only in deleting state", async () => {
  expect(await authenticateDisposableGuest(request())).not.toBeNull();
  expect(store.reserve).not.toHaveBeenCalled();
});

test.each(["active", "deleted", "unexpected", ""])(
  "cleanup rejects policy state %s",
  async (state) => {
    store.read.mockResolvedValue({ ...policy(), state });
    expect(await authenticateDisposableGuest(request())).toBeNull();
  }
);

test.each([0, 2, -1])(
  "cleanup rejects unsupported policy version %s",
  async (policyVersion) => {
    store.read.mockResolvedValue({ ...policy(), policyVersion });
    expect(await authenticateDisposableGuest(request())).toBeNull();
  }
);

test("cleanup rejects a policy with a different model or native binding", async () => {
  store.read.mockResolvedValueOnce({ ...policy(), modelId: "other/model" });
  expect(await authenticateDisposableGuest(request())).toBeNull();
  store.read.mockResolvedValueOnce({
    ...policy(),
    sessionId: "account-session",
  });
  expect(await authenticateDisposableGuest(request())).toBeNull();
  expect(store.reserve).not.toHaveBeenCalled();
});
