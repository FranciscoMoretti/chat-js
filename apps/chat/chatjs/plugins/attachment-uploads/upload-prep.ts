// Utilities for client-side file preparation prior to upload

import imageCompression from "browser-image-compression";

const FILE_EXTENSION_REGEX = /\.[^.]+$/u;

const imageExtension = (mimeType: string): string => {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  if (mimeType === "image/png") {
    return "png";
  }
  const [, extension] = mimeType.split("/");
  return extension ?? "jpg";
};

const compressImageIfNeeded = async (
  file: Readonly<File>,
  {
    maxBytes,
    maxDimension,
    minQuality = 0.5,
  }: Readonly<{
    maxBytes: number;
    maxDimension: number;
    minQuality?: number;
  }>
): Promise<File> => {
  if (!file.type.startsWith("image/")) {
    return file;
  }
  if (file.size <= maxBytes) {
    return file;
  }

  // Only compress JPEG/PNG. Leave others unchanged.
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    return file;
  }

  const outputMime = file.type;

  const options = {
    fileType: outputMime,
    initialQuality: Math.min(0.9, Math.max(minQuality, 0.1)),
    maxSizeMB: maxBytes / (1024 * 1024),
    maxWidthOrHeight: maxDimension,
    useWebWorker: true,
  } as const;

  try {
    const maybeResult = await imageCompression(file, options);
    const resultBlob =
      maybeResult instanceof File
        ? maybeResult
        : new File([maybeResult], file.name, {
            lastModified: Date.now(),
            type: outputMime,
          });
    if (resultBlob.size >= file.size) {
      return file;
    }

    const base = file.name.replace(FILE_EXTENSION_REGEX, "");
    return new File([resultBlob], `${base}.${imageExtension(outputMime)}`, {
      lastModified: Date.now(),
      type: outputMime,
    });
  } catch {
    return file;
  }
};

export const processFilesForUpload = async (
  files: readonly Readonly<File>[],
  options: Readonly<{
    maxBytes: number;
    maxDimension: number;
    acceptedTypes: Readonly<Record<string, readonly string[]>>;
  }>
): Promise<{
  files: File[];
  stillOversized: File[];
  unsupportedFiles: File[];
}> => {
  const prepared: File[] = [];
  const stillOversized: File[] = [];
  const unsupportedFiles: File[] = [];
  const { maxBytes } = options;

  for (const file of files) {
    if (!Object.hasOwn(options.acceptedTypes, file.type)) {
      unsupportedFiles.push(file);
    } else if (file.type.startsWith("image/")) {
      // oxlint-disable-next-line no-await-in-loop -- Compress one image at a time to bound browser worker and memory use.
      const maybeCompressed = await compressImageIfNeeded(file, options);
      if (maybeCompressed.size > maxBytes) {
        stillOversized.push(file);
      } else {
        prepared.push(maybeCompressed);
      }
    } else if (file.type === "application/pdf") {
      if (file.size > maxBytes) {
        stillOversized.push(file);
      } else {
        prepared.push(file);
      }
    } else {
      unsupportedFiles.push(file);
    }
  }

  return { files: prepared, stillOversized, unsupportedFiles };
};
