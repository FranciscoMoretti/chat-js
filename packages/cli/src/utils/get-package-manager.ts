import fs from "node:fs";
import path from "node:path";

import type { PackageManager } from "../types";

export const launcherPackageManager = (): PackageManager => {
  const ua = process.env.npm_config_user_agent ?? "";
  if (ua.startsWith("pnpm/")) {
    return "pnpm";
  }
  if (ua.startsWith("yarn/")) {
    return "yarn";
  }
  if (ua.startsWith("npm/")) {
    return "npm";
  }
  if (ua.startsWith("bun/")) {
    return "bun";
  }

  return "bun";
};

const readDeclaredPackageManager = (
  manifestPath: string
): PackageManager | undefined => {
  if (!fs.existsSync(manifestPath)) {
    return undefined;
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined;
    }
    throw error;
  }

  if (
    !manifest ||
    typeof manifest !== "object" ||
    !("packageManager" in manifest) ||
    typeof manifest.packageManager !== "string"
  ) {
    return undefined;
  }

  const [declared] = manifest.packageManager.split("@");
  return declared === "bun" ||
    declared === "npm" ||
    declared === "pnpm" ||
    declared === "yarn"
    ? declared
    : undefined;
};

export const inferPackageManager = (cwd = process.cwd()): PackageManager => {
  let currentDir = path.resolve(cwd);
  while (true) {
    const manifestPath = path.join(currentDir, "package.json");
    const declared = readDeclaredPackageManager(manifestPath);
    if (declared) {
      return declared;
    }
    if (fs.existsSync(path.join(currentDir, "pnpm-lock.yaml"))) {
      return "pnpm";
    }
    if (fs.existsSync(path.join(currentDir, "yarn.lock"))) {
      return "yarn";
    }
    if (fs.existsSync(path.join(currentDir, "package-lock.json"))) {
      return "npm";
    }
    if (
      fs.existsSync(path.join(currentDir, "bun.lock")) ||
      fs.existsSync(path.join(currentDir, "bun.lockb"))
    ) {
      return "bun";
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return launcherPackageManager();
};
