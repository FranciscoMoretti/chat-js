/* oxlint-disable import/no-nodejs-modules -- This Bun-only registry builder deletes and writes its dist directory and registry.json using asynchronous filesystem operations. */
import { mkdir, rm, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This Bun-only registry builder joins output paths below import.meta.dir using the host platform filesystem separator. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

import { spawn } from "bun";
import { format } from "oxfmt";

import { registry } from "./registry";

const JSON_INDENTATION = 2;
const FORMATTED_LINE_WIDTH = 80;
const SUCCESS_EXIT_CODE = 0;
const NO_FORMATTING_ERRORS = 0;

const cwd = import.meta.dir;
// oxlint-disable-next-line node/no-top-level-await -- This Bun build executable removes prior artifacts before creating the new registry output.
await rm(path.join(cwd, "dist"), { force: true, recursive: true });
// oxlint-disable-next-line node/no-top-level-await -- This Bun build executable creates the source directory before writing registry items.
await mkdir(path.join(cwd, "dist/source"), { recursive: true });
// oxlint-disable-next-line node/no-top-level-await -- This Bun build executable completes all item copies before serializing the registry manifest.
await Promise.all(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The build appends descriptor files to each mutable Shadcn RegistryItem before serializing registry.json.
  registry.items.map(async (item) => {
    const metadata: unknown = item.meta?.chatjs;
    if (
      typeof metadata === "object" &&
      metadata &&
      "kind" in metadata &&
      (metadata.kind === "tool" || metadata.kind === "feature")
    ) {
      const sourcePath = `dist/source/${item.name}.json`;
      const formatted = await format(sourcePath, JSON.stringify(metadata), {
        printWidth: FORMATTED_LINE_WIDTH,
        tabWidth: JSON_INDENTATION,
      });
      if (formatted.errors.length > NO_FORMATTING_ERRORS) {
        throw new Error(`Could not format registry descriptor: ${item.name}`);
      }
      await writeFile(path.join(cwd, sourcePath), formatted.code);
      item.files ??= [];
      item.files.push({
        path: sourcePath,
        target:
          metadata.kind === "feature"
            ? `~/features/${item.name}/chatjs.json`
            : `~/tools/chatjs/${item.name}/chatjs.json`,
        type: "registry:file",
      });
    }
  })
);
// oxlint-disable-next-line node/no-top-level-await -- This Bun build executable writes the registry manifest before invoking shadcn.
await writeFile(
  path.join(cwd, "registry.json"),
  // oxlint-disable-next-line unicorn/no-null -- JSON.stringify accepts null as its identity replacer; no metadata fields are filtered or transformed.
  `${JSON.stringify(registry, null, JSON_INDENTATION)}\n`
);
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
// oxlint-disable-next-line node/no-top-level-await -- This Bun build executable checks the shadcn child exit status before declaring success.
if ((await process.exited) !== SUCCESS_EXIT_CODE) {
  throw new Error("shadcn registry build failed");
}
