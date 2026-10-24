import { mkdir, rm, writeFile } from "node:fs/promises";
import { format } from "oxfmt";
import path from "node:path";
import { registry } from "./registry";
import { spawn } from "bun";

const JSON_INDENTATION = 2;
const FORMATTED_LINE_WIDTH = 80;
const SUCCESS_EXIT_CODE = 0;
const NO_FORMATTING_ERRORS = 0;

const cwd = import.meta.dir;
await rm(path.join(cwd, "dist"), { force: true, recursive: true });
await mkdir(path.join(cwd, "dist/source"), { recursive: true });
await Promise.all(
  registry.items.map(async (item) => {
    const meta: unknown = item.meta;
    const metadata: unknown =
      typeof meta === "object" && meta && "chatjs" in meta && meta.chatjs;
    if (
      typeof metadata === "object" &&
      metadata &&
      "kind" in metadata &&
      (metadata.kind === "tool" || metadata.kind === "plugin")
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
          metadata.kind === "plugin"
            ? `~/plugins/${item.name}/chatjs.json`
            : `~/tools/chatjs/${item.name}/chatjs.json`,
        type: "registry:file",
      });
    }
  })
);
await writeFile(
  path.join(cwd, "registry.json"),
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
if ((await process.exited) !== SUCCESS_EXIT_CODE) {
  throw new Error("shadcn registry build failed");
}
