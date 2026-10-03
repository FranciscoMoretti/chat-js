import { beforeEach, expect, it, vi } from "vitest";

import { fetchEveChannelFile } from "./channel-files";

const mocks = vi.hoisted(() => ({ download: vi.fn(), owned: vi.fn() }));
vi.mock("../db/eve-files", () => ({ assertEveFilesOwned: mocks.owned }));
vi.mock("../file-storage", () => ({ downloadFile: mocks.download }));

const key = "abcdefghijklmnopqrstuvwx.png";
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): owner uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
const owner = {
  attributes: {},
  authenticator: "test",
  principalId: "destination-owner",
  principalType: "user",
} satisfies NonNullable<
  NonNullable<Parameters<typeof fetchEveChannelFile>[1]>["session"]
>["auth"]["current"];
/* oxlint-enable no-magic-numbers */
const context = {
  session: { auth: { current: owner, initiator: owner } },
  state: {},
};
/* oxlint-disable no-undefined --
 * no-undefined (#519): beforeEach uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owned.mockResolvedValue(undefined);
  mocks.download.mockResolvedValue(
    new Blob(["image bytes"], { type: "image/png" })
  );
});
/* oxlint-enable no-undefined */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("checks the destination owner before reading local storage, regardless of the supp uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("checks the destination owner before reading local storage, regardless of the supplied host", async () => {
  const result = await fetchEveChannelFile(
    `https://untrusted.example/api/files/${key}`,
    context
  );
  expect(mocks.owned).toHaveBeenCalledWith(owner.principalId, [key]);
  expect(mocks.download).toHaveBeenCalledWith(key);
  expect(mocks.owned.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.download.mock.invocationCallOrder[0]
  );
  expect(result?.bytes.toString()).toBe("image bytes");
  expect(result?.mediaType).toBe("image/png");
});
/* oxlint-enable no-magic-numbers */

it("never reads a foreign or deleted file after an ownership rejection", async () => {
  mocks.owned.mockRejectedValue(new Error("Not owned"));
  await expect(
    fetchEveChannelFile(`/api/files/${key}`, context)
  ).rejects.toThrow("Not owned");
  expect(mocks.download).not.toHaveBeenCalled();
});

it("does not resolve files without authenticated session context", async () => {
  await expect(fetchEveChannelFile(`/api/files/${key}`)).rejects.toThrow(
    "authenticated owner"
  );
  expect(mocks.owned).not.toHaveBeenCalled();
  expect(mocks.download).not.toHaveBeenCalled();
});

it.each([
  "https://foreign.example/private",
  "/api/files/../../private",
  "https://foreign.example/?next=/api/files/abcdefghijklmnopqrstuvwx.png",
])(
  "leaves unrelated or malformed URL %s to the channel policy",
  async (url) => {
    expect(await fetchEveChannelFile(url, context)).toBeNull();
    expect(mocks.owned).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
  }
);
