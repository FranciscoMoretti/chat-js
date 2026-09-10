import type { createStorageAdapter } from "./storage-provider";

export const storageOptions = {} satisfies Parameters<
  typeof createStorageAdapter
>[0];
export const storageId = "vercel-blob";
export const storageEnvRequirements = [
  {
    description: "Vercel Blob credentials",
    options: [
      ["BLOB_READ_WRITE_TOKEN"],
      ["VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"],
    ],
  },
];
