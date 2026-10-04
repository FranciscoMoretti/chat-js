import path from "node:path";

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
export const isSafeTarget = (targetPath: string, root: string): boolean => {
  if (targetPath.includes("\0")) {
    return false;
  }

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

  const normalizedTarget = path.normalize(decodedPath.replaceAll("\\", "/"));
  const normalizedRoot = path.normalize(root);
  const targetSegments = decodedPath
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean);
  const normalizedSegments = normalizedTarget.split(/[\\/]+/u).filter(Boolean);

  if (targetSegments.includes("..") || normalizedSegments.includes("..")) {
    return false;
  }

  if (/^[a-zA-Z]:[\\/]/u.test(decodedPath)) {
    return false;
  }

  const resolvedPath = path.isAbsolute(normalizedTarget)
    ? normalizedTarget
    : path.resolve(normalizedRoot, normalizedTarget);

  return (
    resolvedPath === normalizedRoot ||
    resolvedPath.startsWith(`${normalizedRoot}${path.sep}`)
  );
};
/* oxlint-enable eslint/max-statements */
