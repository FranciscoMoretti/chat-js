import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { spawn } from "bun";
import { format } from "oxfmt";

import { registry } from "./registry";

const cwd = import.meta.dir;
await rm(path.join(cwd, "dist"), { force: true, recursive: true });
await mkdir(path.join(cwd, "dist/source"), { recursive: true });
await Promise.all(
  registry.items.map(async (item) => {
    const metadata = item.meta?.chatjs;
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
          metadata.kind === "feature"
            ? `~/features/${item.name}/chatjs.json`
            : `~/tools/chatjs/${item.name}/chatjs.json`,
        type: "registry:file",
      });
    }
  })
);
await writeFile(
  path.join(cwd, "registry.json"),
  `${JSON.stringify(registry, null, 2)}\n`
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
if ((await process.exited) !== 0) {
  throw new Error("shadcn registry build failed");
}
