import path from "node:path";

interface FileClaim {
  readonly owner: string;
  readonly source: string;
  readonly target: string;
}

interface OwnedFile {
  readonly path: string;
  readonly kind: "core" | "installable";
  readonly owners: readonly string[];
  readonly sources: readonly string[];
}

const targetPath = (target: string): string => {
  const relative = target.startsWith("~/") ? target.slice("~/".length) : target;
  if (
    !relative ||
    path.posix.isAbsolute(relative) ||
    path.win32.isAbsolute(relative) ||
    relative.includes("\\") ||
    relative
      .split("/")
      .some((segment) => segment === ".." || segment === "." || segment === "")
  ) {
    throw new Error(`Invalid installation target: ${target}`);
  }
  return relative;
};

/** Core is the complement of the selected installation's positive file claims. */
const inventoryFiles = (
  files: readonly string[],
  claims: readonly FileClaim[]
): OwnedFile[] => {
  const byTarget = new Map<string, FileClaim[]>();
  for (const claim of claims) {
    const target = targetPath(claim.target);
    const existing = byTarget.get(target) ?? [];
    existing.push(claim);
    byTarget.set(target, existing);
  }
  return [...new Set([...files, ...byTarget.keys()])].toSorted().map((file) => {
    const owners = byTarget.get(file) ?? [];
    return {
      path: file,
      kind: owners.length > 0 ? "installable" : "core",
      owners: [...new Set(owners.map((claim) => claim.owner))].toSorted(),
      sources: [...new Set(owners.map((claim) => claim.source))].toSorted(),
    };
  });
};

interface ImportEdge {
  readonly from: string;
  readonly to: string;
}

/** Report crossings without silently declaring existing imports public contracts. */
const classifyImport = (
  from: Readonly<OwnedFile>,
  to: Readonly<OwnedFile>
):
  | "core-to-installable"
  | "installable-to-core"
  | "cross-installable"
  | null => {
  if (from.kind === "core" && to.kind === "installable") {
    return "core-to-installable";
  }
  if (from.kind === "installable" && to.kind === "core") {
    return "installable-to-core";
  }
  if (
    from.kind === "installable" &&
    to.kind === "installable" &&
    !from.owners.some((owner) => to.owners.includes(owner))
  ) {
    return "cross-installable";
  }
  return null;
};

export { classifyImport, inventoryFiles, targetPath };
export type { FileClaim, ImportEdge, OwnedFile };
