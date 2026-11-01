// Apps/electron/package.json starts this launcher with Node before Electron Forge.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const FAILURE_EXIT_STATUS = 1;
const COMMAND_ARGUMENT_OFFSET = 2;

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

if (typeof forgeEntrypoint === "string" && forgeEntrypoint !== "") {
  const result = spawnSync(
    process.execPath,
    [forgeEntrypoint, ...process.argv.slice(COMMAND_ARGUMENT_OFFSET)],
    {
      env: process.env,
      stdio: "inherit",
    }
  );

  // Preserve the Forge child's status while allowing inherited output to flush.
  process.exitCode = result.status ?? FAILURE_EXIT_STATUS;
} else {
  console.error("Could not locate @electron-forge/cli.");
  process.exitCode = FAILURE_EXIT_STATUS;
}
