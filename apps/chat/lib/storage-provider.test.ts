import { afterEach, expect, test, vi } from "vitest";

import { createStorageAdapter } from "./storage-provider";

const mocks = vi.hoisted(() => ({
  adapter: vi.fn(() => ({ name: "vercel-blob" })),
  issue: vi.fn(),
  presign: vi.fn(),
}));
vi.mock("@vercel/blob", () => ({
  issueSignedToken: mocks.issue,
  presignUrl: mocks.presign,
}));
vi.mock("files-sdk/vercel-blob", () => ({ vercelBlob: mocks.adapter }));
afterEach(() => vi.useRealTimers());

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("signs only private reads of the requested object for five minutes") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("signs only private reads of the requested object for five minutes") uses 300_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("signs only private reads of the requested object for five minutes", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-25T00:00:00Z"));
  const token = { clientSigningToken: "secret", delegationToken: "delegation" };
  mocks.issue.mockResolvedValue(token);
  mocks.presign.mockResolvedValue({
    presignedUrl: "https://private.example/signed",
  });
  const adapter = createStorageAdapter({ token: "server-secret" });
  expect(await adapter.url("chat/objects/object-key")).toBe(
    "https://private.example/signed"
  );
  const validUntil = Date.now() + 300_000;
  expect(mocks.adapter).toHaveBeenCalledWith({
    access: "private",
    token: "server-secret",
  });
  expect(mocks.issue).toHaveBeenCalledWith(
    expect.objectContaining({
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
});
/* oxlint-enable max-statements, no-magic-numbers */
