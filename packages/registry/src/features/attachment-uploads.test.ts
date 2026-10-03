import { expect, mock, test } from "bun:test";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const compression = mock(
  (_file: File, _options: { maxWidthOrHeight: number }) =>
    Promise.resolve(new Blob(["png"], { type: "image/png" }))
);
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
// oxlint-disable-next-line typescript/no-floating-promises -- The test intentionally starts this operation before inspecting intermediate state; its completion is controlled by the surrounding fixture.
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
  expect(prepared.files).toEqual([pdf]);
  expect(prepared.stillOversized).toEqual([oversized]);
  expect(prepared.unsupportedFiles).toEqual([svg, jpg]);
});
test("small accepted images preserve exact bytes without browser compression", async () => {
  const image = new File(["png"], "photo.png", { type: "image/png" });
  const prepared = await processFilesForUpload([image], options);
  expect(prepared.files).toEqual([image]);
});

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
test("compresses large accepted images and retains failed oversized originals", async () => {
  const image = new File(["oversized image data"], "photo.original", {
    type: "image/png",
  });
  const prepared = await processFilesForUpload([image], options);
  expect(prepared.files[0]?.name).toBe("photo.png");
  expect(prepared.files[0]?.size).toBe(3);
  expect(compression.mock.calls[0]?.[1]).toEqual(
    // oxlint-disable-next-line typescript/no-unsafe-argument -- This test deliberately supplies a partial mock or asymmetric matcher; runtime assertions verify the exercised contract.
    expect.objectContaining({
      maxSizeMB: options.maxBytes / (1024 * 1024),
      maxWidthOrHeight: options.maxDimension,
    })
  );
  compression.mockRejectedValueOnce(new Error("Compression failed"));
  const failed = await processFilesForUpload([image], options);
  expect(failed.stillOversized).toEqual([image]);
  expect(failed.files).toEqual([]);
});
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
test("preparation preserves mixed PDF and compressed-image input order", async () => {
  const pdf = new File(["pdf"], "first.pdf", { type: "application/pdf" });
  const image = new File(["oversized image data"], "second.original", {
    type: "image/png",
  });
  const prepared = await processFilesForUpload([pdf, image], options);
  expect(prepared.files.map((file) => file.name)).toEqual([
    "first.pdf",
    "second.png",
  ]);
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
