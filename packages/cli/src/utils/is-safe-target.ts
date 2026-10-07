// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";

const decodeTargetPath = (targetPath: string): string | false => {
  let decodedPath = targetPath;
  try {
    let previous = "";
    while (decodedPath !== previous && decodedPath.includes("%")) {
      previous = decodedPath;
      decodedPath = decodeURIComponent(decodedPath);
    }
  } catch {
    return false;
  }

  return decodedPath;
};

const hasUnsafeSegments = (
  decodedPath: string,
  normalizedTarget: string
): boolean => {
  const targetSegments = decodedPath
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean);
  const normalizedSegments = normalizedTarget.split(/[\\/]+/u).filter(Boolean);
  return (
    targetSegments.includes("..") ||
    normalizedSegments.includes("..") ||
    /^[a-zA-Z]:[\\/]/u.test(decodedPath)
  );
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (isSafeTarget); the enabled import/no-default-export convention rejects the default-export alternative. */
export const isSafeTarget = (targetPath: string, root: string): boolean => {
  // oxlint-disable-next-line no-ternary -- Keep decodedPath as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const decodedPath = targetPath.includes("\0")
    ? false
    : decodeTargetPath(targetPath);
  if (decodedPath === false) {
    return false;
  }

  const normalizedTarget = path.normalize(decodedPath.replaceAll("\\", "/"));
  const normalizedRoot = path.normalize(root);
  if (hasUnsafeSegments(decodedPath, normalizedTarget)) {
    return false;
  }

  // oxlint-disable-next-line no-ternary -- Keep resolvedPath as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const resolvedPath = path.isAbsolute(normalizedTarget)
    ? normalizedTarget
    : path.resolve(normalizedRoot, normalizedTarget);

  return (
    resolvedPath === normalizedRoot ||
    resolvedPath.startsWith(`${normalizedRoot}${path.sep}`)
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
