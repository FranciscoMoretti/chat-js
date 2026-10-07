import type { VercelBlobAdapterOptions } from "files-sdk/vercel-blob";
import { vercelBlob } from "files-sdk/vercel-blob";

const privateDownloadExpirySeconds = 300;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (createStorageAdapter); the enabled import/no-default-export convention rejects the default-export alternative. */
export const createStorageAdapter = (
  options: Readonly<VercelBlobAdapterOptions> = {}
): ReturnType<typeof vercelBlob> =>
  vercelBlob({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing options own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...options,
    access: "private",
    defaultUrlExpiresIn: privateDownloadExpirySeconds,
  });
/* oxlint-enable import/prefer-default-export, import/no-named-export */
