import type { EnvRequirement } from "./config-requirements";
import type { createStorageAdapter } from "./storage-provider";

/* oxlint-disable no-magic-numbers -- Tuple index zero selects the storage factory options parameter. */
const storageOptions = {} satisfies Parameters<typeof createStorageAdapter>[0];
/* oxlint-enable no-magic-numbers */
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
// oxlint-disable-next-line import/no-named-export -- Generated registrations expose separate named contracts and optional capabilities selected by the installer.
export { storageOptions, storageId, storageEnvRequirements };
