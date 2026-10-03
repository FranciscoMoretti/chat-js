// oxlint-disable-next-line sort-imports -- Generated imports enumerate every installed registration in deterministic order.
import type { EnvRequirement } from "./config-requirements";
// oxlint-disable-next-line sort-imports -- Generated imports enumerate every installed registration in deterministic order.
import type { createStorageAdapter } from "./storage-provider";

/* oxlint-disable no-magic-numbers -- Tuple index zero selects the storage factory options parameter. */
// oxlint-disable-next-line import/no-named-export, import/prefer-default-export, import/group-exports -- Generated named registrations preserve the app import contract, optional capabilities, and immutable custom overrides.
export const storageOptions = {} satisfies Parameters<
  typeof createStorageAdapter
>[0];
/* oxlint-enable no-magic-numbers */
// oxlint-disable-next-line import/no-named-export, import/prefer-default-export, import/group-exports -- Generated named registrations preserve the app import contract, optional capabilities, and immutable custom overrides.
export const storageId = "vercel-blob";
// oxlint-disable-next-line import/no-named-export, import/prefer-default-export, import/group-exports -- Generated named registrations preserve the app import contract, optional capabilities, and immutable custom overrides.
export const storageEnvRequirements: EnvRequirement[] = [
  {
    description: "Vercel Blob credentials",
    options: [
      ["BLOB_READ_WRITE_TOKEN"],
      ["VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"],
    ],
  },
];
