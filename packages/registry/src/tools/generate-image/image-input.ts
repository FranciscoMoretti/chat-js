import type { FileUIPart } from "ai";

import { downloadFile } from "@/lib/file-storage";
import { keyFromFileUrl } from "@/lib/file-url";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getBaseUrl } from "@/lib/url";
/* oxlint-enable sort-imports */

const INLINE_IMAGE =
  /^data:image\/(?:png|jpeg|webp|gif);base64,(?<base64>[A-Za-z0-9+/=]+)$/u;

const fetchImageBuffer = async (value: string): Promise<Buffer> => {
  // Inline images do not initiate a network request.
  const inline = INLINE_IMAGE.exec(value);
  if (
    typeof inline?.groups?.base64 === "string" &&
    inline.groups.base64 !== ""
  ) {
    return Buffer.from(inline.groups.base64, "base64");
  }
  const url = new URL(value, getBaseUrl());
  const { origin } = new URL(getBaseUrl());
  const key = keyFromFileUrl(value);
  if (
    url.origin !== origin ||
    url.username !== "" ||
    url.password !== "" ||
    !(typeof key === "string" && key !== "")
  ) {
    throw new Error(
      "Image editing only accepts uploaded ChatJS files or inline images."
    );
  }
  // Read the configured storage directly. Never follow user-supplied URLs or redirects.
  const file = await downloadFile(key);
  return Buffer.from(await file.arrayBuffer());
};

const collectEditImages = async ({
  imageParts,
  lastGeneratedImage,
}: Readonly<{
  imageParts: readonly Readonly<Pick<FileUIPart, "url">>[];
  lastGeneratedImage: Readonly<{ imageUrl: string }> | null;
}>): Promise<Buffer[]> =>
  await Promise.all([
    ...(lastGeneratedImage
      ? [fetchImageBuffer(lastGeneratedImage.imageUrl)]
      : []),
    ...imageParts.map(
      async (imagePart) => await fetchImageBuffer(imagePart.url)
    ),
  ]);

export { collectEditImages };
