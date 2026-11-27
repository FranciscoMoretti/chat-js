import { PROVIDER_NAMES, getProvider } from "files-sdk/providers";

const unsupported = ["box", "bun-s3", "convex", "fs", "s3-fetch"] as const;
export type SupportedStorageId = Exclude<
  (typeof PROVIDER_NAMES)[number],
  (typeof unsupported)[number]
>;
const unavailable: ReadonlySet<string> = new Set(unsupported);

/** Shared provider metadata without the registry builder's filesystem dependencies. */
export const builtInStorageProviders = PROVIDER_NAMES.filter(
  (id): id is SupportedStorageId => !unavailable.has(id)
).map((id) => {
  const provider = getProvider(id);
  if (!provider) {
    throw new Error(`Missing Files SDK provider: ${id}`);
  }
  return { ...provider, slug: id };
});
