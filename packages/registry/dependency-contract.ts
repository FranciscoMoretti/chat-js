import type { RegistryItem } from "shadcn/schema";
import registryPackage from "./package.json";
import { inheritedRegistryDependencies } from "./core-dependencies";
import {
  auditDependencies,
  dependencyName,
} from "@chat-js/registry-validation/ownership";

/** Registry authors choose names; the package that tests the registry pins their versions. */
export const versionedRegistryItem = (item: RegistryItem): RegistryItem => {
  const versions: Readonly<Record<string, string>> =
    registryPackage.devDependencies;
  const version = (spec: string): string => {
    const name = dependencyName(spec);
    if (name !== spec) {
      return spec;
    }
    if (!versions[name]) {
      throw new Error(`Missing tested registry dependency version: ${name}`);
    }
    return `${name}@${versions[name]}`;
  };
  return {
    ...item,
    dependencies: item.dependencies?.map(version),
    devDependencies: item.devDependencies?.map(version),
  };
};

/** Audit each owner separately: another item or core cannot satisfy its declaration. */
export const assertItemDependencies = (
  item: Readonly<RegistryItem>,
  files: ReadonlyMap<string, string>
): void => {
  const diagnostics = auditDependencies(item, files, {
    inheritedPackages: inheritedRegistryDependencies,
    localImportPrefixes: ["@/"],
  });
  if (diagnostics.length > 0) {
    throw new Error(
      diagnostics.map((diagnostic) => diagnostic.message).join("\n")
    );
  }
};
