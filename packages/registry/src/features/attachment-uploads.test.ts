import { expect, mock, test } from "bun:test";

const compression = mock(
  (_file: File, _options: { maxWidthOrHeight: number }) =>
    Promise.resolve(new Blob(["png"], { type: "image/png" }))
);
mock.module("browser-image-compression", () => ({ default: compression }));
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
  expect(prepared.pdfFiles).toEqual([pdf]);
  expect(prepared.stillOversized).toEqual([oversized]);
  expect(prepared.unsupportedFiles).toEqual([svg, jpg]);
});
test("small accepted images preserve exact bytes without browser compression", async () => {
  const image = new File(["png"], "photo.png", { type: "image/png" });
  const prepared = await processFilesForUpload([image], options);
  expect(prepared.processedImages).toEqual([image]);
});

test("compresses large accepted images and retains failed oversized originals", async () => {
  const image = new File(["oversized image data"], "photo.original", {
    type: "image/png",
  });
  const prepared = await processFilesForUpload([image], options);
  expect(prepared.processedImages[0]?.name).toBe("photo.png");
  expect(prepared.processedImages[0]?.size).toBe(3);
  expect(compression.mock.calls[0]?.[1]).toEqual(
    expect.objectContaining({
      maxSizeMB: options.maxBytes / (1024 * 1024),
      maxWidthOrHeight: options.maxDimension,
    })
  );
  compression.mockRejectedValueOnce(new Error("Compression failed"));
  const failed = await processFilesForUpload([image], options);
  expect(failed.stillOversized).toEqual([image]);
  expect(failed.processedImages).toEqual([]);
});
