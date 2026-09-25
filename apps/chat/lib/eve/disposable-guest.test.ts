/* oxlint-disable eslint/no-await-in-loop -- Sequential adversarial requests keep each authorization assertion explicit. */
import { randomUUID } from "node:crypto";

import { afterEach, expect, test, vi } from "vitest";

import {
  issueGuestCredential,
  newGuestClaims,
  readGuestCredential,
} from "./disposable-guest";
import { authenticateDisposableGuest } from "./disposable-guest-auth";

vi.mock("../env", () => ({
  env: {
    EVE_GATEWAY_SECRET: "test-guest-signing-secret-at-least-32-characters",
  },
}));
afterEach(() => vi.useRealTimers());

const claims = () => ({
  ...newGuestClaims("test-model"),
  sessionId: "session-owned",
});
const request = (token: string, path: string, body?: unknown) =>
  new Request(`https://chat.example/eve/v1/${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
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
  for (const sessionId of ["registered-session", randomUUID()]) {
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
  }
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
  for (const path of [
    "session/session-owned/checkpoint",
    "session/session-owned/sandbox-identity",
    "operation/owned",
  ]) {
    expect(await authenticateDisposableGuest(request(token, path))).toBeNull();
  }
  for (const body of [
    { message: "hello", modelId: "expensive-model" },
    { clientContext: "override", message: "hello" },
    { fork: { sessionId: "victim" }, message: "hello" },
    { message: [{ data: "https://private.invalid", type: "file" }] },
    { inputResponses: [{ requestId: "external" }] },
  ]) {
    expect(
      await authenticateDisposableGuest(
        request(token, "session/session-owned", body)
      )
    ).toBeNull();
  }
});

test("server-only bootstrap credentials authorize empty creation, never session access", async () => {
  const token = issueGuestCredential(newGuestClaims("test-model"));
  expect(
    await authenticateDisposableGuest(request(token, "session", {}))
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
