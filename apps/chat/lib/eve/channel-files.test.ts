import { beforeEach, expect, it, vi } from "vitest";

import { fetchEveChannelFile } from "./channel-files";

const mocks = vi.hoisted(() => ({ download: vi.fn(), owned: vi.fn() }));
vi.mock("../db/eve-files", () => ({ assertEveFilesOwned: mocks.owned }));
vi.mock("../file-storage", () => ({ downloadFile: mocks.download }));

const key = "abcdefghijklmnopqrstuvwx.png";
const owner = {
  attributes: {},
  authenticator: "test",
  principalId: "destination-owner",
  principalType: "user",
} satisfies NonNullable<
  NonNullable<Parameters<typeof fetchEveChannelFile>[1]>["session"]
>["auth"]["current"];
const context = {
  session: { auth: { current: owner, initiator: owner } },
  state: {},
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owned.mockResolvedValue(undefined);
  mocks.download.mockResolvedValue(
    new Blob(["image bytes"], { type: "image/png" })
  );
});

it("checks the destination owner before reading local storage, regardless of the supplied host", async () => {
  const result = await fetchEveChannelFile(
    `https://untrusted.example/api/files/content?key=${key}`,
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

it("never reads a foreign or deleted file after an ownership rejection", async () => {
  mocks.owned.mockRejectedValue(new Error("Not owned"));
  await expect(
    fetchEveChannelFile(`/api/files/content?key=${key}`, context)
  ).rejects.toThrow("Not owned");
  expect(mocks.download).not.toHaveBeenCalled();
});

it("does not resolve files without authenticated session context", async () => {
  await expect(
    fetchEveChannelFile(`/api/files/content?key=${key}`)
  ).rejects.toThrow("authenticated owner");
  expect(mocks.owned).not.toHaveBeenCalled();
  expect(mocks.download).not.toHaveBeenCalled();
});

it.each([
  "https://foreign.example/private",
  "/api/files/content?key=../../private",
  "https://foreign.example/?next=/api/files/content?key=abcdefghijklmnopqrstuvwx.png",
])(
  "leaves unrelated or malformed URL %s to the channel policy",
  async (url) => {
    expect(await fetchEveChannelFile(url, context)).toBeNull();
    expect(mocks.owned).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
  }
);
