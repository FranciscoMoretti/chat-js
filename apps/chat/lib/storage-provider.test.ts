import { afterEach, expect, test, vi } from "vitest";

import { createStorageAdapter } from "./storage-provider";

const mocks = vi.hoisted(() => ({
  issue: vi.fn(),
  presign: vi.fn(),
}));
vi.mock("@vercel/blob", () => ({
  issueSignedToken: mocks.issue,
  presignUrl: mocks.presign,
}));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([   { token: "server-secret" },   { oidcToken: "oidc-secret", storeId: "store_fixture" }, 's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- Keep credential, capability and signed-read assertions together for each authentication mode. */
/* oxlint-disable eslint/no-magic-numbers -- These values assert the credential-scoped five-minute download contract. */
test.each([
  { token: "server-secret" },
  { oidcToken: "oidc-secret", storeId: "store_fixture" },
])(
  "the Files SDK signs private reads with configured credentials %j",
  async (
    credentials: Readonly<{
      token?: string;
      oidcToken?: string;
      storeId?: string;
    }>
  ) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T00:00:00Z"));
    const token = {
      clientSigningToken: "secret",
      delegationToken: "delegation",
    };
    mocks.issue.mockResolvedValue(token);
    mocks.presign.mockResolvedValue({
      presignedUrl: "https://private.example/signed",
    });
    const adapter = createStorageAdapter(credentials);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading supported from adapter.signedUrl; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    expect(adapter.signedUrl?.supported).toBe(true);
    expect(await adapter.url("chat/objects/object-key")).toBe(
      "https://private.example/signed"
    );
    const validUntil = Date.now() + 300_000;
    expect(mocks.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing credentials own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...credentials,
        operations: ["get"],
        pathname: "chat/objects/object-key",
        validUntil,
      })
    );
    expect(mocks.presign).toHaveBeenCalledWith(token, {
      access: "private",
      operation: "get",
      pathname: "chat/objects/object-key",
      validUntil,
    });
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("the Files SDK honors a caller's shorter expiry and cancellation signal", async () => {
  const { signal } = new AbortController();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-25T00:00:00Z"));
  mocks.issue.mockResolvedValue({
    clientSigningToken: "secret",
    delegationToken: "delegation",
  });
  mocks.presign.mockResolvedValue({
    presignedUrl: "https://private.example/signed",
  });
  await createStorageAdapter({ token: "server-secret" }).url("one-object", {
    expiresIn: 60,
    signal,
  });
  expect(mocks.issue).toHaveBeenCalledWith(
    expect.objectContaining({
      abortSignal: signal,
      operations: ["get"],
      pathname: "one-object",
      validUntil: Date.now() + 60_000,
    })
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/no-magic-numbers */
