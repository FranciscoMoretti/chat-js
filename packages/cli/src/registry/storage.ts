import { storageDefinitionSchema } from "../../../registry/metadata";
import type { StorageDefinition } from "../../../registry/metadata";
import { itemAddress, readItem } from "./shadcn";

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
  const definition = storageDefinitionSchema.parse(item.meta?.chatjs);
  if (
    !item.files?.some((file) => file.target === "~/lib/storage-provider.ts")
  ) {
    throw new Error(
      "Storage must install lib/storage-provider.ts exporting createStorageAdapter."
    );
  }
  return { definition, options: {}, source: address };
};
