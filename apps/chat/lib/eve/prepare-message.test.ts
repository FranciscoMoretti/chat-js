import { expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ download: vi.fn(), model: vi.fn() }));
vi.mock("../file-storage", () => ({ downloadFile: mocks.download }));
vi.mock("./model-selection", () => ({ loadEveModelDefinition: mocks.model }));
vi.mock("../config", () => ({
  config: { features: { attachments: true }, attachments: { maxBytes: 1024 } },
}));

import { eveMessageInput } from "./message-input";
import { prepareEveMessage } from "./prepare-message";

const attachment = {
  type: "file",
  data: "/api/files/content?key=abcdefghijklmnopqrstuvwx.png",
  mediaType: "image/png",
  filename: "image.png",
};

test("only accepts supported ChatJS attachment references", () => {
  expect(eveMessageInput.safeParse([attachment]).success).toBe(true);
  for (const data of [
    "https://evil.test/api/files/content?key=abcdefghijklmnopqrstuvwx.png",
    "http://127.0.0.1/private",
    "data:image/png;base64,eA==",
    "/api/files/content?key=../../secret",
  ]) {
    expect(eveMessageInput.safeParse([{ ...attachment, data }]).success).toBe(
      false
    );
  }
  expect(
    eveMessageInput.safeParse([{ ...attachment, mediaType: "text/html" }])
      .success
  ).toBe(false);
});

test("reads verified bytes from storage and rejects mismatched types and unsupported models", async () => {
  mocks.model.mockResolvedValue({ input: { image: true, pdf: false } });
  mocks.download.mockResolvedValue(
    new Blob(["image bytes"], { type: "image/png" })
  );
  const input = eveMessageInput.parse([attachment]);
  await expect(prepareEveMessage(input, "vision")).resolves.toEqual([
    {
      type: "file",
      filename: "image.png",
      mediaType: "image/png",
      data: "data:image/png;base64,aW1hZ2UgYnl0ZXM=",
    },
  ]);
  expect(mocks.download).toHaveBeenCalledWith("abcdefghijklmnopqrstuvwx.png");
  mocks.download.mockResolvedValue(
    new Blob(["not an image"], { type: "text/html" })
  );
  await expect(prepareEveMessage(input, "vision")).rejects.toThrow(
    "content type"
  );
  mocks.download.mockResolvedValue(
    new Blob([new Uint8Array(1025)], { type: "image/png" })
  );
  await expect(prepareEveMessage(input, "vision")).rejects.toThrow("size");
  mocks.model.mockResolvedValue({ input: { image: false, pdf: false } });
  await expect(prepareEveMessage(input, "text")).rejects.toThrow(
    "does not support"
  );
});
