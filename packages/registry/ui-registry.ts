import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema, toolDefinitionSchema } from "./metadata";
import { uiImplementations } from "./ui-implementations";

/** Produce native source for a library without changing public item addresses. */
export const registryItemForUi = (
  item: RegistryItem,
  base: "base" | "radix",
  nativeSources: ReadonlyMap<string, string> = new Map()
): RegistryItem => {
  if (base === "base" && nativeSources.size === 0) {
    return item;
  }
  const original: unknown = item.meta?.chatjs;
  let metadata = original;
  if (
    typeof original === "object" &&
    original !== null &&
    "contractVersion" in original &&
    original.contractVersion === 2 &&
    "kind" in original
  ) {
    if (original.kind === "plugin") {
      metadata = pluginDefinitionSchema.parse({ ...original, uiBase: base });
    } else if (original.kind === "tool") {
      metadata = toolDefinitionSchema.parse({ ...original, uiBase: base });
    }
  }
  return {
    ...item,
    ...(item.meta ? { meta: { ...item.meta, chatjs: metadata } } : {}),
    ...(item.files
      ? {
          files: item.files.map((file) => {
            if (typeof file.content !== "string") {
              return file;
            }
            if (
              metadata !== original &&
              file.target?.endsWith("/chatjs.json") === true
            ) {
              return {
                ...file,
                content: `${JSON.stringify(metadata, null, 2)}\n`,
              };
            }
            const target = file.target?.replace(/^~\//u, "") ?? file.path;
            if (uiImplementations.some((entry) => entry.target === target)) {
              const content = nativeSources.get(target);
              if (content === undefined) {
                throw new Error(`Missing selected native source for ${target}`);
              }
              return { ...file, content };
            }
            return file;
          }),
        }
      : {}),
  };
};
