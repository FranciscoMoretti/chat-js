/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { mkdir, rm, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

import { spawn } from "bun";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { format } from "oxfmt";
/* oxlint-enable eslint/sort-imports */

import { registry } from "./registry";

const cwd = import.meta.dir;
/* oxlint-disable node/no-top-level-await -- Module initialization must complete before dependent code consumes the prepared runtime or build artifact. */
await rm(path.join(cwd, "dist"), { force: true, recursive: true });
/* oxlint-enable node/no-top-level-await */
/* oxlint-disable node/no-top-level-await -- Module initialization must complete before dependent code consumes the prepared runtime or build artifact. */
await mkdir(path.join(cwd, "dist/source"), { recursive: true });
/* oxlint-enable node/no-top-level-await */
/* oxlint-disable node/no-top-level-await -- Module initialization must complete before dependent code consumes the prepared runtime or build artifact. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
await Promise.all(
  registry.items.map(async (item) => {
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- Shadcn metadata is an open JSON extension point; preserve third-party fields while inspecting the ChatJS discriminator rather than impose a new stripping schema.
    const metadata = item.meta?.chatjs;
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Shadcn metadata is an open JSON extension point; preserve third-party fields while inspecting the ChatJS discriminator rather than impose a new stripping schema.
    if (metadata?.kind === "tool" || metadata?.kind === "feature") {
      const sourcePath = `dist/source/${item.name}.json`;
      const formatted = await format(sourcePath, JSON.stringify(metadata), {
        printWidth: 80,
        tabWidth: 2,
      });
      if (formatted.errors.length > 0) {
        throw new Error(`Could not format registry descriptor: ${item.name}`);
      }
      await writeFile(path.join(cwd, sourcePath), formatted.code);
      item.files ??= [];
      item.files.push({
        path: sourcePath,
        target:
          // oxlint-disable-next-line typescript/no-unsafe-member-access -- Shadcn metadata is an open JSON extension point; preserve third-party fields while inspecting the ChatJS discriminator rather than impose a new stripping schema.
          metadata.kind === "feature"
            ? `~/features/${item.name}/chatjs.json`
            : `~/tools/chatjs/${item.name}/chatjs.json`,
        type: "registry:file",
      });
    }
  })
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable node/no-top-level-await */
/* oxlint-disable node/no-top-level-await -- Module initialization must complete before dependent code consumes the prepared runtime or build artifact. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
await writeFile(
  path.join(cwd, "registry.json"),
  `${JSON.stringify(registry, null, 2)}\n`
);
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable node/no-top-level-await */
const process = spawn(
  [
    "bunx",
    "--bun",
    "shadcn@4.21.0",
    "build",
    "registry.json",
    "--output",
    "dist/r",
  ],
  { cwd, stderr: "inherit", stdout: "inherit" }
);
/* oxlint-disable node/no-top-level-await -- Module initialization must complete before dependent code consumes the prepared runtime or build artifact. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
if ((await process.exited) !== 0) {
  throw new Error("shadcn registry build failed");
}
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-top-level-await */
