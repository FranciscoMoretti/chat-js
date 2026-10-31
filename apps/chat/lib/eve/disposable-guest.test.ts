import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  issueGuestCredential,
  newGuestClaims,
  readGuestCredential,
} from "@/chatjs/plugins/guest-chat/guest-credential";
import { authenticateDisposableGuest } from "@/chatjs/plugins/guest-chat/guest-auth";
import { randomUUID } from "node:crypto";

vi.mock("../env", () => ({
  env: {
    EVE_GATEWAY_SECRET: "test-guest-signing-secret-at-least-32-characters",
  },
}));
const store = vi.hoisted(() => ({ read: vi.fn(), reserve: vi.fn() }));
vi.mock("@/chatjs/plugins/guest-chat/guest-queries", () => ({
  readGuestRuntimePolicy: store.read,
  reserveGuestRuntimeMessage: store.reserve,
}));
beforeEach(() => {
  store.read.mockImplementation((id: string) => ({
    id,
    modelId: "openai/gpt-5-nano",
    sessionId: "session-owned",
    state: "active",
    policyVersion: 1,
    credentialExpiresAt: new Date(Date.now() + 3_600_000),
    expiresAt: new Date(Date.now() + 86_400_000),
  }));
  store.reserve.mockResolvedValue("ready");
});
afterEach(() => vi.useRealTimers());

const claims = (): ReturnType<typeof newGuestClaims> & {
  sessionId: string;
} => ({
  ...newGuestClaims("openai/gpt-5-nano"),
  sessionId: "session-owned",
});

const request = (token: string, path: string, body?: unknown): Request =>
  new Request(`https://chat.example/eve/v1/${path}`, {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    method: body === undefined ? "GET" : "POST",
  });

test("credentials are signed, expire, and cannot be edited to name another session", () => {
  vi.useFakeTimers();
  const original = claims();
  const token = issueGuestCredential(original);
  expect(readGuestCredential(token)).toEqual(original);
  const forged = `${Buffer.from(JSON.stringify({ ...original, sessionId: "victim" })).toString("base64url")}.${token.split(".")[1]}`;
  expect(readGuestCredential(forged)).toBeNull();
  expect(readGuestCredential(`${token}.extra`)).toBeNull();
  vi.setSystemTime(original.expiresAt);
  expect(readGuestCredential(token)).toBeNull();
});

test("every read, send, cancel and retirement is restricted to the signed session", async () => {
  const token = issueGuestCredential(claims());
  expect(
    await authenticateDisposableGuest(
      request(token, "session/session-owned/stream")
    )
  ).toMatchObject({ principalType: "user" });
  expect(
    await authenticateDisposableGuest(
      request(token, "session/session-owned", { message: "hello" })
    )
  ).not.toBeNull();
  expect(
    await authenticateDisposableGuest(
      request(token, "session/session-owned/cancel", {})
    )
  ).not.toBeNull();
  expect(
    await authenticateDisposableGuest(
      request(token, "session/session-owned/reset", {})
    )
  ).not.toBeNull();
  await Promise.all(
    ["registered-session", randomUUID()].map(async (sessionId) => {
      expect(
        await authenticateDisposableGuest(
          request(token, `session/${sessionId}/stream`)
        )
      ).toBeNull();
      expect(
        await authenticateDisposableGuest(
          request(token, `session/${sessionId}`, { message: "hello" })
        )
      ).toBeNull();
      expect(
        await authenticateDisposableGuest(
          request(token, `session/${sessionId}/cancel`, {})
        )
      ).toBeNull();
    })
  );
  expect(
    await authenticateDisposableGuest(
      request("", "session/session-owned/stream")
    )
  ).toBeNull();
});
test("browser credentials cannot create, fork, read checkpoints or submit tools, files or privileged context", async () => {
  const token = issueGuestCredential(claims());
  expect(
    await authenticateDisposableGuest(request(token, "session", {}))
  ).toBeNull();
  await Promise.all(
    [
      "session/session-owned/checkpoint",
      "session/session-owned/local-resources",
      "operation/owned",
    ].map(async (path) => {
      expect(
        await authenticateDisposableGuest(request(token, path))
      ).toBeNull();
    })
  );
  await Promise.all(
    [
      { message: "hello", modelId: "expensive-model" },
      { clientContext: "override", message: "hello" },
      { fork: { sessionId: "victim" }, message: "hello" },
      { message: [{ data: "https://private.invalid", type: "file" }] },
      { inputResponses: [{ requestId: "external" }] },
    ].map(async (body) => {
      expect(
        await authenticateDisposableGuest(
          request(token, "session/session-owned", body)
        )
      ).toBeNull();
    })
  );
});
test("server-only bootstrap credentials authorize bound-operation creation, never session access", async () => {
  const creation = newGuestClaims("openai/gpt-5-nano");
  store.read.mockResolvedValue({
    id: creation.policyId,
    modelId: creation.modelId,
    sessionId: null,
    state: "active",
    policyVersion: 1,
    credentialExpiresAt: new Date(creation.expiresAt),
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  const token = issueGuestCredential(creation);
  expect(
    await authenticateDisposableGuest(
      request(token, "session", { operationId: creation.policyId })
    )
  ).not.toBeNull();
  expect(
    await authenticateDisposableGuest(
      request(token, "session", { message: "hello" })
    )
  ).toBeNull();
  expect(
    await authenticateDisposableGuest(
      request(token, "session/session-owned/stream")
    )
  ).toBeNull();
});

test("a valid signature cannot bypass missing, revoked or mismatched stored policy", async () => {
  const token = issueGuestCredential(claims());
  for (const policy of [
    null,
    { state: "deleted" },
    { state: "active", policyVersion: 1, modelId: "expensive" },
  ]) {
    store.read.mockResolvedValue(policy);
    expect(
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each case changes the shared database mock before checking authorization.
      await authenticateDisposableGuest(
        request(token, "session/session-owned/stream")
      )
    ).toBeNull();
  }
});

test("input limits and rate limiting deny execution at the shared channel", async () => {
  const token = issueGuestCredential(claims());
  for (const status of ["input-limit", "rate-limited", "unavailable"]) {
    store.reserve.mockResolvedValue(status);
    expect(
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each case changes the shared database mock before checking authorization.
      await authenticateDisposableGuest(
        request(token, "session/session-owned", { message: "hello" })
      )
    ).toBeNull();
  }
});

test("cleanup credentials work only for deleting sessions and cannot send messages", async () => {
  const identity = { ...claims(), purpose: "cleanup" as const };
  const token = issueGuestCredential(identity);
  expect(
    await authenticateDisposableGuest(
      request(token, "session/session-owned/reset", {
        reason: "Guest retention expired",
      })
    )
  ).toBeNull();
  store.read.mockResolvedValue({
    id: identity.policyId,
    sessionId: identity.sessionId,
    modelId: identity.modelId,
    state: "deleting",
    policyVersion: 1,
  });
  expect(
    await authenticateDisposableGuest(
      request(token, "session/session-owned/reset", {
        reason: "Guest retention expired",
      })
    )
  ).not.toBeNull();
  expect(
    await authenticateDisposableGuest(
      request(token, "session/session-owned", { message: "hello" })
    )
  ).toBeNull();
});

test("cleanup retires old gateway sessions without permitting new messages or other sessions", async () => {
  const previous = {
    ...claims(),
    modelId: "gpt-5-nano",
    purpose: "cleanup" as const,
  };
  store.read.mockResolvedValue({
    id: previous.policyId,
    modelId: previous.modelId,
    sessionId: previous.sessionId,
    state: "deleting",
    policyVersion: 1,
  });
  const token = issueGuestCredential(previous);
  expect(
    await authenticateDisposableGuest(
      request(token, "session/session-owned/reset", {
        reason: "Guest retention expired",
      })
    )
  ).not.toBeNull();
  expect(
    await authenticateDisposableGuest(
      request(token, "session/session-owned", { message: "hello" })
    )
  ).toBeNull();
  expect(
    await authenticateDisposableGuest(request(token, "session/other/reset", {}))
  ).toBeNull();
  const mismatched = issueGuestCredential({ ...previous, modelId: "wrong" });
  expect(
    await authenticateDisposableGuest(
      request(mismatched, "session/session-owned/reset", {})
    )
  ).toBeNull();
});
