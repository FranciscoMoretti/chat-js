const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const candidates = [
  path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "node_modules",
    "@electron-forge",
    "cli",
    "dist",
    "electron-forge.js"
  ),
  path.resolve(
    __dirname,
    "..",
    "node_modules",
    "@electron-forge",
    "cli",
    "dist",
    "electron-forge.js"
  ),
];

const forgeEntrypoint = candidates.find((candidate) => {
  try {
    fs.accessSync(candidate);
    return true;
  } catch {
    return false;
  }
});

if (!forgeEntrypoint) {
  console.error("Could not locate @electron-forge/cli.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [forgeEntrypoint, ...process.argv.slice(2)],
  {
    env: process.env,
    stdio: "inherit",
  }
);

process.exit(result.status ?? 1);
