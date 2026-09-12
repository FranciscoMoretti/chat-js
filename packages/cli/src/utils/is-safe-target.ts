import path from "node:path";

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
