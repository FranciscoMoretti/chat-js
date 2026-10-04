import { expect, mock, test } from "bun:test";

/* oxlint-disable typescript/promise-function-async -- The compression mock returns a resolved Blob promise directly; making this fixed stub async would introduce an unnecessary await solely to satisfy require-await. */
const compression = mock(
  (_file: Readonly<File>, _options: Readonly<{ maxWidthOrHeight: number }>) =>
    Promise.resolve(new Blob(["png"], { type: "image/png" }))
);
/* oxlint-enable typescript/promise-function-async */
await mock.module("browser-image-compression", () => ({
  default: compression,
}));
const { processFilesForUpload } =
  await import("./attachment-uploads/features/attachment-uploads/upload-prep");

const options = {
  acceptedTypes: { "application/pdf": [".pdf"], "image/png": [".png"] },
  maxBytes: 10,
  maxDimension: 2048,
};
test("upload preparation respects configured accepted types and size limits", async () => {
  const pdf = new File(["pdf"], "document.pdf", { type: "application/pdf" });
  const oversized = new File(["oversized document"], "large.pdf", {
    type: "application/pdf",
  });
  const svg = new File(["svg"], "image.svg", { type: "image/svg+xml" });
  const jpg = new File(["jpg"], "photo.jpg", { type: "image/jpeg" });
  const prepared = await processFilesForUpload(
    [pdf, oversized, svg, jpg],
    options
  );
  expect(prepared.files).toEqual([pdf]);
  expect(prepared.stillOversized).toEqual([oversized]);
  expect(prepared.unsupportedFiles).toEqual([svg, jpg]);
});
test("small accepted images preserve exact bytes without browser compression", async () => {
  const image = new File(["png"], "photo.png", { type: "image/png" });
  const prepared = await processFilesForUpload([image], options);
  expect(prepared.files).toEqual([image]);
});

/* oxlint-disable eslint/no-magic-numbers -- Assert the three-byte compressed Blob and convert configured bytes to MiB using the documented 1024-byte units. */
test("compresses large accepted images and retains failed oversized originals", async () => {
  const image = new File(["oversized image data"], "photo.original", {
    type: "image/png",
  });
  const prepared = await processFilesForUpload([image], options);
  expect(prepared.files[0]?.name).toBe("photo.png");
  expect(prepared.files[0]?.size).toBe(3);
  expect(compression.mock.calls[0]?.[1]).toMatchObject({
    maxSizeMB: options.maxBytes / (1024 * 1024),
    maxWidthOrHeight: options.maxDimension,
  });
  compression.mockRejectedValueOnce(new Error("Compression failed"));
  const failed = await processFilesForUpload([image], options);
  expect(failed.stillOversized).toEqual([image]);
  expect(failed.files).toEqual([]);
});
/* oxlint-enable eslint/no-magic-numbers */

test("preparation preserves mixed PDF and compressed-image input order", async () => {
  const pdf = new File(["pdf"], "first.pdf", { type: "application/pdf" });
  const image = new File(["oversized image data"], "second.original", {
    type: "image/png",
  });
  const prepared = await processFilesForUpload([pdf, image], options);
  expect(prepared.files.map((file: Readonly<File>) => file.name)).toEqual([
    "first.pdf",
    "second.png",
  ]);
});
