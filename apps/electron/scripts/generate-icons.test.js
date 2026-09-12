import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

import forgeConfig from "../forge.config";

const appRoot = path.resolve(import.meta.dir, "..");
const buildDir = path.join(appRoot, "build");
const outputFiles = ["icon.png", "icon.icns", "icon.ico"];

const cleanupGeneratedIcons = () => {
  for (const file of outputFiles) {
    rmSync(path.join(buildDir, file), { force: true });
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
      expect(existsSync(path.join(buildDir, file))).toBe(true);
    }
  });

  test("forge config points packager at generated icons", () => {
    expect(forgeConfig.packagerConfig?.icon).toBe("./build/icon");
  });
});
