import { describe, expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This integration test launches the icon generator and verifies its files on the host filesystem.
import { spawnSync } from "node:child_process";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
// oxlint-disable-next-line import/no-nodejs-modules -- This integration test launches the icon generator and verifies its files on the host filesystem.
import { existsSync, rmSync } from "node:fs";
/* oxlint-enable sort-imports */
// oxlint-disable-next-line import/no-nodejs-modules -- This integration test launches the icon generator and verifies its files on the host filesystem.
import path from "node:path";

/* oxlint-disable import/no-relative-parent-imports -- the ../forge.config import: The source and its build/scaffold consumers share this relative module layout; replacing it needs an alias contract in every consumer. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import forgeConfig from "../forge.config";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

const appRoot = path.resolve(import.meta.dir, "..");
const buildDir = path.join(appRoot, "build");
const outputFiles = ["icon.png", "icon.icns", "icon.ico"];

/* oxlint-disable node/no-sync -- cleanupGeneratedIcons: Synchronous fixture setup/readback keeps each assertion tied to a completed filesystem/process boundary. */
const cleanupGeneratedIcons = () => {
  for (const file of outputFiles) {
    rmSync(path.join(buildDir, file), { force: true });
  }
};
/* oxlint-enable node/no-sync */

/* oxlint-disable node/no-sync -- generate-icons: Synchronous fixture setup/readback keeps each assertion tied to a completed filesystem/process boundary. */
/* oxlint-disable eslint/no-magic-numbers -- generate-icons: Literal IDs, expected counts and timing bounds belong to this fixed scenario and its assertions. */
describe("generate-icons", () => {
  test("writes Forge-compatible icon assets", () => {
    cleanupGeneratedIcons();

    const result = spawnSync("bun", ["scripts/generate-icons.ts"], {
      cwd: appRoot,
      encoding: "utf-8",
      stdio: "pipe",
    });

    expect(result.status).toBe(0);

    for (const file of outputFiles) {
      expect(existsSync(path.join(buildDir, file))).toBe(true);
    }
  });

  test("forge config points packager at generated icons", () => {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading icon from forgeConfig.packagerConfig; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(forgeConfig.packagerConfig?.icon).toBe("./build/icon");
  });
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-sync */
