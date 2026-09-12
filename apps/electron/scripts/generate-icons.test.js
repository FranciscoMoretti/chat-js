const { existsSync, rmSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, expect, test } = require("bun:test");
const forgeConfig = require("../forge.config").default;

const appRoot = resolve(__dirname, "..");
const buildDir = join(appRoot, "build");
const outputFiles = ["icon.png", "icon.icns", "icon.ico"];

const cleanupGeneratedIcons = () => {
  for (const file of outputFiles) {
    rmSync(join(buildDir, file), { force: true });
  }
};

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
      expect(existsSync(join(buildDir, file))).toBe(true);
    }
  });

  test("forge config points packager at generated icons", () => {
    expect(forgeConfig.packagerConfig?.icon).toBe("./build/icon");
  });
});
