// This explicit .cjs entrypoint must retain CommonJS startup semantics.
/* oxlint-disable import/no-commonjs, typescript/no-require-imports, typescript/no-var-requires -- Electron Forge is launched from this explicit CommonJS entrypoint; require and __dirname preserve its Node startup contract. */
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
  // oxlint-disable-next-line unicorn/no-process-exit -- Missing Forge cannot launch; terminate this wrapper before spawning a child.
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

// oxlint-disable-next-line unicorn/no-process-exit -- Forward the completed child status to the invoking package manager.
process.exit(result.status ?? 1);
