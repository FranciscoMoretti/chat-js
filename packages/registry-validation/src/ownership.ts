import ts from "typescript";
import { builtinModules } from "node:module";
import { z } from "zod";

const importedBuiltins: unknown = builtinModules;
const nodeBuiltins = z.array(z.string()).parse(importedBuiltins);

export const dependencyName = (spec: string): string => {
  const separator = spec.indexOf("@", 1);
  return separator === -1 ? spec : spec.slice(0, separator);
};

export interface DependencyOwner {
  readonly name: string;
  readonly files?: readonly { readonly path: string }[];
  readonly dependencies?: readonly string[];
  readonly devDependencies?: readonly string[];
}

export interface OwnershipDiagnostic {
  readonly code: "missing-source" | "undeclared-dependency";
  readonly owner: string;
  readonly file: string;
  readonly dependency?: string;
  readonly message: string;
}

/** Check original sources per owner, before installation or app-wide merging. */
export const auditDependencies = (
  owner: DependencyOwner,
  sources: ReadonlyMap<string, string>,
  contract: Readonly<{
    inheritedPackages?: readonly string[];
    localImportPrefixes?: readonly string[];
  }> = {}
): OwnershipDiagnostic[] => {
  const allowed = new Set([
    ...(contract.inheritedPackages ?? []),
    ...(owner.dependencies ?? []).map(dependencyName),
    ...(owner.devDependencies ?? []).map(dependencyName),
  ]);
  const diagnostics: OwnershipDiagnostic[] = [];
  for (const file of owner.files ?? []) {
    if (!/\.[cm]?[jt]sx?$/u.test(file.path)) {
      continue;
    }
    const source = sources.get(file.path);
    if (source === undefined) {
      diagnostics.push({
        code: "missing-source",
        owner: owner.name,
        file: file.path,
        message: `Missing dependency audit source: ${file.path}`,
      });
      continue;
    }
    for (const imported of ts.preProcessFile(source, true, true)
      .importedFiles) {
      const specifier = imported.fileName;
      if (
        specifier.startsWith(".") ||
        (contract.localImportPrefixes ?? []).some((prefix) =>
          specifier.startsWith(prefix)
        ) ||
        specifier.startsWith("node:") ||
        nodeBuiltins.includes(specifier)
      ) {
        continue;
      }
      const name = specifier
        .split("/")
        .slice(0, specifier.startsWith("@") ? 2 : 1)
        .join("/");
      if (!allowed.has(name)) {
        diagnostics.push({
          code: "undeclared-dependency",
          owner: owner.name,
          file: file.path,
          dependency: name,
          message: `${owner.name}: undeclared dependency ${name} in ${file.path}`,
        });
      }
    }
  }
  return diagnostics;
};
