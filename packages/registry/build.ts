/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { mkdir, rm, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

import { spawn } from "bun";
import { format } from "oxfmt";

import { registry } from "./registry";

const cwd = import.meta.dir;
await rm(path.join(cwd, "dist"), { force: true, recursive: true });
await mkdir(path.join(cwd, "dist/source"), { recursive: true });
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
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
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
await writeFile(
  path.join(cwd, "registry.json"),
  `${JSON.stringify(registry, null, 2)}\n`
);
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
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
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
if ((await process.exited) !== 0) {
  throw new Error("shadcn registry build failed");
}
/* oxlint-enable eslint/no-magic-numbers */
