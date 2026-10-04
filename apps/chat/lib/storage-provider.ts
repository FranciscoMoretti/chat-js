import type { VercelBlobAdapterOptions } from "files-sdk/vercel-blob";
import { vercelBlob } from "files-sdk/vercel-blob";

const privateDownloadExpirySeconds = 300;

export const createStorageAdapter = (
  options: Readonly<VercelBlobAdapterOptions> = {}
): ReturnType<typeof vercelBlob> =>
  vercelBlob({
    ...options,
    access: "private",
    defaultUrlExpiresIn: privateDownloadExpirySeconds,
  });
