/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
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
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/prefer-default-export */
