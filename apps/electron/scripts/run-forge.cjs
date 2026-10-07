// Apps/electron/package.json starts this launcher with Node before Electron Forge.
/* oxlint-disable import/no-commonjs, typescript/no-var-requires -- Node's .cjs wrapper supplies require and __dirname to resolve and spawn the installed Forge entrypoint. */
// oxlint-disable-next-line import/no-nodejs-modules, typescript/no-require-imports -- This .cjs launcher needs synchronous built-in loading before Forge starts; static imports cannot run in CommonJS and dynamic imports would make the launcher asynchronous.
const { spawnSync } = require("node:child_process");
// oxlint-disable-next-line import/no-nodejs-modules, typescript/no-require-imports -- This .cjs launcher needs synchronous built-in loading before Forge starts; static imports cannot run in CommonJS and dynamic imports would make the launcher asynchronous.
const fs = require("node:fs");
// oxlint-disable-next-line import/no-nodejs-modules, typescript/no-require-imports -- This .cjs launcher needs synchronous built-in loading before Forge starts; static imports cannot run in CommonJS and dynamic imports would make the launcher asynchronous.
const path = require("node:path");
/* oxlint-enable import/no-commonjs, typescript/no-var-requires */

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

/* oxlint-disable node/no-sync -- forgeEntrypoint: Forge/startup uses synchronous configuration and filesystem contracts before the desktop process is ready. */
const forgeEntrypoint = candidates.find((candidate) => {
  try {
    fs.accessSync(candidate);
    return true;
  } catch {
    return false;
  }
});
/* oxlint-enable node/no-sync */

/* oxlint-disable eslint/no-console -- run-forge.cjs: This command or desktop boundary reports startup, progress and failures to its operator. */
/* oxlint-disable typescript/strict-boolean-expressions -- run-forge.cjs: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
if (!forgeEntrypoint) {
  console.error("Could not locate @electron-forge/cli.");
  // oxlint-disable-next-line unicorn/no-process-exit -- Missing Forge cannot launch; terminate this wrapper before spawning a child.
  process.exit(FAILURE_EXIT_STATUS);
}
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/no-console */

/* oxlint-disable node/no-sync -- result: Forge/startup uses synchronous configuration and filesystem contracts before the desktop process is ready. */
/* oxlint-disable node/no-process-env -- result: This process boundary owns environment loading/forwarding; consumers receive the resulting validated configuration. */
const result = spawnSync(
  process.execPath,
  [forgeEntrypoint, ...process.argv.slice(COMMAND_ARGUMENT_OFFSET)],
  {
    env: process.env,
    stdio: "inherit",
  }
);
/* oxlint-enable node/no-process-env */
/* oxlint-enable node/no-sync */

// oxlint-disable-next-line unicorn/no-process-exit -- Forward the completed child status to the invoking package manager.
process.exit(result.status ?? FAILURE_EXIT_STATUS);
