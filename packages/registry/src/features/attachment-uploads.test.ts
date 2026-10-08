import { expect, mock, test } from "bun:test";

const COMPRESSED_IMAGE_TEXT = "png";
const BYTES_PER_MEBIBYTE = 1_048_576;

const compression = mock<
  (
    file: Readonly<File>,
    options: Readonly<{ maxWidthOrHeight: number }>
  ) => Promise<Blob>
>().mockResolvedValue(new Blob([COMPRESSED_IMAGE_TEXT], { type: "image/png" }));
// oxlint-disable-next-line node/no-top-level-await -- Bun must install the compression mock before loading the upload implementation.
await mock.module("browser-image-compression", () => ({
  default: compression,
}));
const { processFilesForUpload } =
  // oxlint-disable-next-line node/no-top-level-await -- This Bun test loads upload preparation only after the compression mock is installed.
  await import("./attachment-uploads/features/attachment-uploads/upload-prep");

const options = {
  acceptedTypes: { "application/pdf": [".pdf"], "image/png": [".png"] },
  maxBytes: 10,
  maxDimension: 2048,
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("small accepted images preserve exact bytes without browser compression", async () => {
  const image = new File(["png"], "photo.png", { type: "image/png" });
  const prepared = await processFilesForUpload([image], options);
  expect(prepared.files).toEqual([image]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("compresses large accepted images with configured limits", async () => {
  const image = new File(["oversized image data"], "photo.original", {
    type: "image/png",
  });
  const prepared = await processFilesForUpload([image], options);
  const [compressedFile] = prepared.files;
  const [compressionCall = []] = compression.mock.calls;
  const [, compressionOptions] = compressionCall;
  // oxlint-disable-next-line oxc/no-optional-chaining -- Preserve the test's existing undefined short-circuit when the compressed file is absent.
  expect(compressedFile?.name).toBe("photo.png");
  // oxlint-disable-next-line oxc/no-optional-chaining -- Preserve the test's existing undefined short-circuit when the compressed file is absent.
  expect(compressedFile?.size).toBe(COMPRESSED_IMAGE_TEXT.length);
  expect(compressionOptions).toMatchObject({
    maxSizeMB: options.maxBytes / BYTES_PER_MEBIBYTE,
    maxWidthOrHeight: options.maxDimension,
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("preserves MIME getter order during image compression", async () => {
  const image = new File(["oversized image data"], "photo.original", {
    type: "image/png",
  });
  const mimeTypes = [
    "image/png",
    "image/png",
    "image/png",
    "image/png",
    "image/jpeg",
  ];
  Object.defineProperty(image, "type", {
    get: () => mimeTypes.shift() ?? "image/png",
  });

  const prepared = await processFilesForUpload([image], options);

  expect(mimeTypes).toEqual([]);
  expect(prepared.files.map((file: Readonly<File>) => file.name)).toEqual([
    "photo.jpg",
  ]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("retains failed oversized originals", async () => {
  const image = new File(["oversized image data"], "photo.original", {
    type: "image/png",
  });
  compression.mockRejectedValueOnce(new Error("Compression failed"));
  const failed = await processFilesForUpload([image], options);
  expect(failed.stillOversized).toEqual([image]);
  expect(failed.files).toEqual([]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
