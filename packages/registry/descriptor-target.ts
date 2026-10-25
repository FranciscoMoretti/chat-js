import type { RegistryItem } from "shadcn/schema";

export const descriptorTarget = (
  item: Readonly<RegistryItem>
): string | undefined => {
  const metadata: unknown = item.meta?.chatjs;
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    !("kind" in metadata)
  ) {
    return undefined;
  }
  if (metadata.kind === "plugin") {
    return `~/plugins/${item.name}/chatjs.json`;
  }
  if (metadata.kind === "tool") {
    return `~/tools/chatjs/${item.name}/chatjs.json`;
  }
  return undefined;
};
