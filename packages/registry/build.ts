import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { registry } from "./registry";

const cwd = import.meta.dir;
await rm(path.join(cwd, "dist"), { recursive: true, force: true });
await mkdir(path.join(cwd, "dist/source"), { recursive: true });
for (const item of registry.items) {
  const metadata = item.meta?.chatjs;
  if (metadata?.kind === "tool") {
    const sourcePath = `dist/source/${item.name}.json`;
    await writeFile(
      path.join(cwd, sourcePath),
      `${JSON.stringify(metadata, null, 2)}\n`
    );
    item.files ??= [];
    item.files.push({
      path: sourcePath,
      type: "registry:file",
      target: `~/tools/chatjs/${item.name}/chatjs.json`,
    });
  }
}
await writeFile(
  path.join(cwd, "registry.json"),
  `${JSON.stringify(registry, null, 2)}\n`
);
const process = Bun.spawn(
  [
    "bunx",
    "--bun",
    "shadcn@4.21.0",
    "build",
    "registry.json",
    "--output",
    "dist/r",
  ],
  { cwd, stdout: "inherit", stderr: "inherit" }
);
if ((await process.exited) !== 0) {
  throw new Error("shadcn registry build failed");
}
