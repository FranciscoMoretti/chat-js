/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import { randomUUID } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
/* oxlint-disable eslint/no-await-in-loop -- Sequential adversarial requests keep each authorization assertion explicit. */
import { afterEach, expect, test, vi } from "vitest";
import {
  issueGuestCredential,
  newGuestClaims,
  readGuestCredential,
} from "./disposable-guest";
import { authenticateDisposableGuest } from "./disposable-guest-auth";
import { randomUUID } from "node:crypto";

/* oxlint-enable import/no-nodejs-modules */

vi.mock("../env", () => ({
  env: {
    EVE_GATEWAY_SECRET: "test-guest-signing-secret-at-least-32-characters",
  },
}));
afterEach(() => vi.useRealTimers());

const claims = (): ReturnType<typeof newGuestClaims> & {
  sessionId: string;
} => ({
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing newGuestClaims("test-model") own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  ...newGuestClaims("test-model"),
  sessionId: "session-owned",
});

const request = (token: string, path: string, body?: unknown): Request =>
  new Request(`https://chat.example/eve/v1/${path}`, {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    // oxlint-disable-next-line no-undefined, no-ternary -- Request method distinguishes an omitted body from null; unicorn/no-typeof-undefined rejects the equivalent typeof comparison.
    method: body === undefined ? "GET" : "POST",
  });

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("credentials are signed, expire, and cannot be edited to name another session") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("credentials are signed, expire, and cannot be edited to name another session", () => {
  vi.useFakeTimers();
  const original = claims();
  const token = issueGuestCredential(original);
  expect(readGuestCredential(token)).toEqual(original);
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing original own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  const forged = `${Buffer.from(JSON.stringify({ ...original, sessionId: "victim" })).toString("base64url")}.${token.split(".")[1]}`;
  expect(readGuestCredential(forged)).toBeNull();
  expect(readGuestCredential(`${token}.extra`)).toBeNull();
  vi.setSystemTime(original.expiresAt);
  expect(readGuestCredential(token)).toBeNull();
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
