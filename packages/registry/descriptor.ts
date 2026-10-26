import { descriptorTarget } from "./descriptor-target";
import type { RegistryItem } from "shadcn/schema";
import { format } from "oxfmt";

/** Build, development mirroring and validation use the same installed descriptor. */
export const registryDescriptor = async (
  item: Readonly<RegistryItem>
): Promise<NonNullable<RegistryItem["files"]>[number] | undefined> => {
  const metadata: unknown = item.meta?.chatjs;
  const target = descriptorTarget(item);
  if (target === undefined) {
    return undefined;
  }
  const source = `dist/source/${item.name}.json`;
  const formatted = await format(source, JSON.stringify(metadata), {
    printWidth: 80,
    tabWidth: 2,
  });
  if (formatted.errors.length > 0) {
    throw new Error(`Could not format registry descriptor: ${item.name}`);
  }
  return {
    path: source,
    target,
    type: "registry:file",
    content: formatted.code,
  };
};
