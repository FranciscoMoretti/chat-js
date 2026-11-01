import { PROVIDER_NAMES, getProvider } from "files-sdk/providers";

const unsupported = new Set(["box", "bun-s3", "convex", "fs", "s3-fetch"]);

/** Shared provider metadata without the registry builder's filesystem dependencies. */
export const builtInStorageProviders = PROVIDER_NAMES.filter(
  (id) => !unsupported.has(id)
).map((id) => {
  const provider = getProvider(id);
  if (!provider) {
    throw new Error(`Missing Files SDK provider: ${id}`);
  }
  return { ...provider, slug: id };
});
