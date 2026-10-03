/* oxlint-disable node/no-top-level-await -- Module initialization must complete before dependent code consumes the prepared runtime or build artifact. */
const result = await Bun.build({
  entrypoints: [
    `${import.meta.dir}/src/index.ts`,
    `${import.meta.dir}/src/react.ts`,
  ],
  format: "esm",
  outdir: `${import.meta.dir}/dist`,
  packages: "external",
  splitting: true,
  target: "browser",
});
/* oxlint-enable node/no-top-level-await */

/* oxlint-disable eslint/no-console -- This is the explicit command-line or library error-reporting boundary; writing to the console is the intended observable output. */
if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  throw new Error("Failed to build @chat-js/thread");
}
/* oxlint-enable eslint/no-console */

const reactPath = `${import.meta.dir}/dist/react.js`;
/* oxlint-disable node/no-top-level-await -- Module initialization must complete before dependent code consumes the prepared runtime or build artifact. */
const reactSource = await Bun.file(reactPath).text();
/* oxlint-enable node/no-top-level-await */
const clientDirective = `"use client";`;
/* oxlint-disable node/no-top-level-await -- Module initialization must complete before dependent code consumes the prepared runtime or build artifact. */
await Bun.write(
  reactPath,
  `${clientDirective}\n${reactSource.replaceAll(clientDirective, "")}`
);
/* oxlint-enable node/no-top-level-await */
