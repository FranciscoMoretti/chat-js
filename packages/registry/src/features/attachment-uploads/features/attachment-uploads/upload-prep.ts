// Utilities for client-side file preparation prior to upload

import imageCompression from "browser-image-compression";

const FILE_EXTENSION_REGEX = /\.[^.]+$/u;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve compressImageIfNeeded's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const compressImageIfNeeded = async (
  file: File,
  {
    maxBytes,
    maxDimension,
    minQuality = 0.5,
  }: {
    maxBytes: number;
    maxDimension: number;
    minQuality?: number;
  }
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
    let ext: string;
    if (outputMime === "image/jpeg") {
      ext = "jpg";
    } else if (outputMime === "image/png") {
      ext = "png";
    } else {
      ext = outputMime.split("/")[1] ?? "jpg";
    }
    return new File([resultBlob], `${base}.${ext}`, {
      lastModified: Date.now(),
      type: outputMime,
    });
  } catch {
    return file;
  }
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (processFilesForUpload); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve processFilesForUpload's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/no-continue -- Skipping an ineligible item here keeps the remaining per-item operation inside the same loop and cleanup scope. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const processFilesForUpload = async (
  files: File[],
  options: {
    maxBytes: number;
    maxDimension: number;
    acceptedTypes: Record<string, string[]>;
  }
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
        continue;
      }
      prepared.push(maybeCompressed);
    } else if (file.type === "application/pdf") {
      if (file.size > maxBytes) {
        stillOversized.push(file);
        continue;
      }
      prepared.push(file);
    } else {
      unsupportedFiles.push(file);
    }
  }

  return { files: prepared, stillOversized, unsupportedFiles };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-continue */
/* oxlint-enable eslint/max-statements */
