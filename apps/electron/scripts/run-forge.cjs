// Apps/electron/package.json starts this launcher with Node before Electron Forge.
/* oxlint-disable import/no-commonjs -- Node's .cjs wrapper supplies require and __dirname to resolve and spawn the installed Forge entrypoint. */
// oxlint-disable-next-line import/no-nodejs-modules, typescript/no-require-imports -- This .cjs launcher needs synchronous built-in loading before Forge starts; static imports cannot run in CommonJS and dynamic imports would make the launcher asynchronous.
const { spawnSync } = require("node:child_process"); // oxlint-disable-line typescript/no-var-requires -- Preserve native synchronous CommonJS loading in this .cjs launcher.
// oxlint-disable-next-line import/no-nodejs-modules, typescript/no-require-imports -- This .cjs launcher needs synchronous built-in loading before Forge starts; static imports cannot run in CommonJS and dynamic imports would make the launcher asynchronous.
const fs = require("node:fs"); // oxlint-disable-line typescript/no-var-requires -- Preserve native synchronous CommonJS loading in this .cjs launcher.
// oxlint-disable-next-line import/no-nodejs-modules, typescript/no-require-imports -- This .cjs launcher needs synchronous built-in loading before Forge starts; static imports cannot run in CommonJS and dynamic imports would make the launcher asynchronous.
const path = require("node:path"); // oxlint-disable-line typescript/no-var-requires -- Preserve native synchronous CommonJS loading in this .cjs launcher.
/* oxlint-enable import/no-commonjs */

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
if (typeof forgeEntrypoint === "string" && forgeEntrypoint !== "") {
  /* oxlint-disable node/no-sync -- result: Forge/startup uses synchronous configuration and filesystem contracts before the desktop process is ready. */
  const result = spawnSync(
    process.execPath,
    [forgeEntrypoint, ...process.argv.slice(COMMAND_ARGUMENT_OFFSET)],
    {
      // oxlint-disable-next-line node/no-process-env -- The launcher forwards the full host environment to the Forge child process.
      env: process.env,
      stdio: "inherit",
    }
  );
  /* oxlint-enable node/no-sync */

  // Preserve the Forge child's status while allowing inherited output to flush.
  process.exitCode = result.status ?? FAILURE_EXIT_STATUS;
} else {
  console.error("Could not locate @electron-forge/cli.");
  process.exitCode = FAILURE_EXIT_STATUS;
}
/* oxlint-enable eslint/no-console */
