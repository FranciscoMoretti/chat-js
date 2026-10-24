import type { RegistryItem } from "shadcn/schema";
import type { FileClaim } from "./file-ownership";
import type { InstallationSelection } from "../installation";

const installationItems = (
  catalog: readonly RegistryItem[],
  selection: Readonly<InstallationSelection>
): RegistryItem[] => {
  const pending = [
    ...selection.plugins,
    ...selection.tools,
    ...(typeof selection.gateway === "string" && selection.gateway !== ""
      ? [`${selection.gateway}-gateway`]
      : []),
    ...(selection.storage ? [`${selection.storage.source}-storage`] : []),
    ...(typeof selection.sandbox === "string" && selection.sandbox !== ""
      ? [`${selection.sandbox}-sandbox`]
      : []),
  ];
  const selected = new Map<string, RegistryItem>();
  for (const name of pending) {
    if (selected.has(name)) {
      continue;
    }
    const item = catalog.find((candidate) => candidate.name === name);
    if (!item) {
      throw new Error(`Unknown local registry item: ${name}`);
    }
    selected.set(name, item);
    for (const dependency of item.registryDependencies ?? []) {
      if (!dependency.startsWith("@chatjs/")) {
        throw new Error(`Unsupported registry dependency: ${dependency}`);
      }
      pending.push(dependency.slice("@chatjs/".length));
    }
  }
  return [...selected.values()];
};

const itemClaims = (item: Readonly<RegistryItem>): FileClaim[] => {
  const claims = (item.files ?? []).map((file) => {
    if (typeof file.target !== "string" || file.target === "") {
      throw new Error(`Missing explicit target: ${item.name}/${file.path}`);
    }
    return { owner: item.name, source: file.path, target: file.target };
  });
  const metadata: unknown = item.meta?.chatjs;
  if (typeof metadata === "object" && metadata && "kind" in metadata) {
    const { kind } = metadata;
    if (kind === "tool" || kind === "plugin") {
      const directory = kind === "tool" ? "tools/chatjs" : "plugins";
      claims.push({
        owner: item.name,
        source: `descriptor:${item.name}`,
        target: `${directory}/${item.name}/chatjs.json`,
      });
    }
  }
  return claims;
};

export { installationItems, itemClaims };
