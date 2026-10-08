/// <reference types="bun" />

// oxlint-disable-next-line node/no-top-level-await -- This Bun build executable completes library bundling before updating the React entry directive.
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

/* oxlint-disable eslint/no-console -- This is the explicit command-line or library error-reporting boundary; writing to the console is the intended observable output. */
if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  throw new Error("Failed to build @chat-js/thread");
}
/* oxlint-enable eslint/no-console */

const reactPath = `${import.meta.dir}/dist/react.js`;
// oxlint-disable-next-line node/no-top-level-await -- This Bun build executable reads the emitted React entry before moving its client directive.
const reactSource = await Bun.file(reactPath).text();
const clientDirective = `"use client";`;
// oxlint-disable-next-line node/no-top-level-await -- This Bun build executable finishes writing the React entry before the build command completes.
await Bun.write(
  reactPath,
  `${clientDirective}\n${reactSource.replaceAll(clientDirective, "")}`
);
