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
    expect(adapter.signedUrl?.supported).toBe(true);
    expect(await adapter.url("chat/objects/object-key")).toBe(
      "https://private.example/signed"
    );
    const validUntil = Date.now() + 300_000;
    expect(mocks.issue).toHaveBeenCalledWith(
      expect.objectContaining({
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
/* oxlint-enable eslint/no-magic-numbers */
