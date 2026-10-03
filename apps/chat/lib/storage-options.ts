import type { EnvRequirement } from "./config-requirements";
import type { createStorageAdapter } from "./storage-provider";

/* oxlint-disable no-magic-numbers -- Tuple index zero selects the storage factory options parameter. */
// oxlint-disable-next-line import/group-exports -- Generated registrations expose separate named contracts and optional capabilities selected by the installer.
export const storageOptions = {} satisfies Parameters<
  typeof createStorageAdapter
>[0];
/* oxlint-enable no-magic-numbers */
// oxlint-disable-next-line import/group-exports -- Generated registrations expose separate named contracts and optional capabilities selected by the installer.
export const storageId = "vercel-blob";
// oxlint-disable-next-line import/group-exports -- Generated registrations expose separate named contracts and optional capabilities selected by the installer.
export const storageEnvRequirements: EnvRequirement[] = [
  {
    description: "Vercel Blob credentials",
    options: [
      ["BLOB_READ_WRITE_TOKEN"],
      ["VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"],
    ],
  },
];
