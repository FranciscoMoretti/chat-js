import type { EnvRequirement } from "@/lib/config-requirements";
import type { createStorageAdapter } from "@/chatjs/providers/storage";

const storageOptions = {} satisfies Parameters<typeof createStorageAdapter>[0];
const storageId = "vercel-blob";
const storageEnvRequirements: EnvRequirement[] = [
  {
    description: "Vercel Blob credentials",
    options: [
      ["BLOB_READ_WRITE_TOKEN"],
      ["VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"],
    ],
  },
];
export { storageOptions, storageId, storageEnvRequirements };
