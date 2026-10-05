import type { VercelBlobAdapterOptions } from "files-sdk/vercel-blob";
import { vercelBlob } from "files-sdk/vercel-blob";

const privateDownloadExpirySeconds = 300;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (createStorageAdapter); the enabled import/no-default-export convention rejects the default-export alternative. */
export const createStorageAdapter = (
  options: Readonly<VercelBlobAdapterOptions> = {}
): ReturnType<typeof vercelBlob> =>
  vercelBlob({
    ...options,
    access: "private",
    defaultUrlExpiresIn: privateDownloadExpirySeconds,
  });
/* oxlint-enable import/prefer-default-export, import/no-named-export */
