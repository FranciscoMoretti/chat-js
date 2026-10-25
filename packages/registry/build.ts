import { assertItemDependencies } from "./dependency-contract";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { registryDescriptor } from "./descriptor";
import path from "node:path";
import { registry } from "./registry";
import { spawn } from "bun";

const JSON_INDENTATION = 2;
const SUCCESS_EXIT_CODE = 0;

const cwd = import.meta.dir;
await rm(path.join(cwd, "dist"), { force: true, recursive: true });
await mkdir(path.join(cwd, "dist/source"), { recursive: true });
await Promise.all(
  registry.items.map(async (item) => {
    const sources = new Map(
      await Promise.all(
        (item.files ?? []).map(
          async (file) =>
            [
              file.path,
              await readFile(path.join(cwd, file.path), "utf-8"),
            ] as const
        )
      )
    );
    assertItemDependencies(item, sources);
    const descriptor = await registryDescriptor(item);
    if (descriptor) {
      await writeFile(
        path.join(cwd, descriptor.path),
        descriptor.content ?? ""
      );
      item.files ??= [];
      const { content: _content, ...file } = descriptor;
      item.files.push(file);
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
