import type { VercelBlobAdapterOptions } from "files-sdk/vercel-blob";
import { vercelBlob } from "files-sdk/vercel-blob";

const privateDownloadExpirySeconds = 300;

// oxlint-disable-next-line import/prefer-default-export, import/no-named-export -- The registry installs this named createStorageAdapter contract; the enabled import/no-default-export rule rejects a default export.
export const createStorageAdapter = (
  options: Readonly<VercelBlobAdapterOptions> = {}
): ReturnType<typeof vercelBlob> =>
  vercelBlob({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing options own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...options,
    access: "private",
    defaultUrlExpiresIn: privateDownloadExpirySeconds,
  });
