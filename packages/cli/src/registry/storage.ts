import { itemAddress, readItem } from "./shadcn";
import type { StorageDefinition } from "../../../registry/metadata";
import { storageDefinitionSchema } from "../../../registry/metadata";

type RegistryFile = NonNullable<
  Awaited<ReturnType<typeof readItem>>["files"]
>[number];

export interface StorageSelection {
  source: string;
  definition: StorageDefinition;
  options: Record<string, unknown>;
}

export const resolveStorage = async (
  source: string,
  cwd = process.cwd()
): Promise<StorageSelection> => {
  const address = itemAddress(source, "storage");
  const item = await readItem(address, cwd);
  if (item.type !== "registry:item") {
    throw new Error("Selected storage must have type registry:item.");
  }
  const { chatjs } = item.meta ?? {};
  const definition = storageDefinitionSchema.parse(chatjs);
  if (
    !(item.files ?? []).some(
      (file: Readonly<RegistryFile>) =>
        file.target === "~/lib/storage-provider.ts"
    )
  ) {
    throw new Error(
      "Storage must install lib/storage-provider.ts exporting createStorageAdapter."
    );
  }
  return { definition, options: {}, source: address };
};
