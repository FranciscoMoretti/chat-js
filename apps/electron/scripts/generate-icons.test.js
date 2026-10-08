import { describe, expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This integration test verifies generated icons on the host filesystem.
import { existsSync, rmSync } from "node:fs";
/* oxlint-disable import/no-relative-parent-imports -- The test loads the desktop Forge configuration from its authored relative path. */
import forgeConfig from "../forge.config";
/* oxlint-enable import/no-relative-parent-imports */
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the integration test's native filesystem paths.
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules -- Launch the icon generator through its native process boundary.
import { spawnSync } from "node:child_process";

const SUCCESS_EXIT_CODE = 0;

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
describe("generate-icons", () => {
  test("writes Forge-compatible icon assets", () => {
    cleanupGeneratedIcons();

    const result = spawnSync("bun", ["scripts/generate-icons.ts"], {
      cwd: appRoot,
      encoding: "utf-8",
      stdio: "pipe",
    });

    expect(result.status).toBe(SUCCESS_EXIT_CODE);

    for (const file of outputFiles) {
      expect(existsSync(path.join(buildDir, file))).toBe(true);
    }
  });

  test("forge config points packager at generated icons", () => {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading icon from forgeConfig.packagerConfig; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(forgeConfig.packagerConfig?.icon).toBe("./build/icon");
  });
});
/* oxlint-enable node/no-sync */
