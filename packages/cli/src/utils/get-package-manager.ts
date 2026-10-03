/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import fs from "node:fs";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { PackageManager } from "../types";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
const launcherPackageManager = (): PackageManager => {
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
/* oxlint-enable node/no-process-env */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
const inferPackageManager = (cwd = process.cwd()): PackageManager => {
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
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/max-statements */
export { inferPackageManager, launcherPackageManager };
