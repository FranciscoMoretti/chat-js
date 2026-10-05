/* oxlint-disable import/no-relative-parent-imports -- StorageSelection preserves the descriptor type inferred from the canonical registry schema; the registry package exports generated JSON only, with no metadata type subpath. */
import type { StorageDefinition } from "../../../registry/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- Storage descriptors are validated by the canonical registry metadata schema; the CLI Bun build bundles this sibling-package source, whose package exposes only generated registry JSON subpaths. */
import { storageDefinitionSchema } from "../../../registry/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { itemAddress, readItem } from "./shadcn";
/* oxlint-enable sort-imports */

type RegistryFile = NonNullable<
  Awaited<ReturnType<typeof readItem>>["files"]
>[number];

/* oxlint-disable import/no-named-export -- Keep the named type bindings (StorageSelection); the enabled import/no-default-export convention rejects the default-export alternative. */
export interface StorageSelection {
  source: string;
  definition: StorageDefinition;
  options: Record<string, unknown>;
}
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (resolveStorage); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resolveStorage's awaited sequencing and rejected-Promise behavior. */
export const resolveStorage = async (
  source: string,
  cwd = process.cwd()
): Promise<StorageSelection> => {
  const address = itemAddress(source, "storage");
  const item = await readItem(address, cwd);
  if (item.type !== "registry:item") {
    throw new Error("Selected storage must have type registry:item.");
  }
  const definition = storageDefinitionSchema.parse(item.meta?.chatjs);
  if (
    item.files?.some(
      (file: Readonly<RegistryFile>) =>
        file.target === "~/lib/storage-provider.ts"
    ) !== true
  ) {
    throw new Error(
      "Storage must install lib/storage-provider.ts exporting createStorageAdapter."
    );
  }
  return { definition, options: {}, source: address };
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable oxc/no-async-await */
