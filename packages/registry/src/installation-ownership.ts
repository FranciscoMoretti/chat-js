import { descriptorTarget } from "../descriptor-target";
import type { RegistryItem } from "shadcn/schema";
import { targetPath } from "./file-ownership";
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
      // Bare shadcn prerequisites belong to the host, not the ChatJS inventory.
      if (/^[a-z][a-z0-9-]*$/u.test(dependency)) {
        continue;
      }
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
  const target = descriptorTarget(item);
  if (
    target !== undefined &&
    !claims.some((claim) => targetPath(claim.target) === targetPath(target))
  ) {
    claims.push({
      owner: item.name,
      source: `descriptor:${item.name}`,
      target: targetPath(target),
    });
  }
  return claims;
};

export { installationItems, itemClaims };
