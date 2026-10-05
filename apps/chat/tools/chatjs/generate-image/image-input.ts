import type { FileUIPart } from "ai";

import { downloadFile } from "@/lib/file-storage";
import { keyFromFileUrl } from "@/lib/file-url";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getBaseUrl } from "@/lib/url";
/* oxlint-enable sort-imports */

const INLINE_IMAGE =
  /^data:image\/(?:png|jpeg|webp|gif);base64,(?<base64>[A-Za-z0-9+/=]+)$/u;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetchImageBuffer's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve collectEditImages's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (collectEditImages); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export { collectEditImages };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
