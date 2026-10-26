import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { format } from "oxfmt";
import path from "node:path";
import { registry } from "./registry";
import { spawn } from "bun";
import { registryItemSchema, registrySchema } from "shadcn/schema";
import { registryItemForUi } from "./ui-registry";

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

// Keep the published root namespace compatible with existing Base installs.
// Each native namespace is complete; @chatjs dependencies resolve through the
// consumer's selected namespace, retaining the same item IDs and target paths.
const output = path.join(cwd, "dist/r");
const outputFiles = await readdir(output);
const builtFiles = outputFiles.filter((file) => file.endsWith(".json"));
await Promise.all(
  (["base", "radix"] as const).map(async (base) => {
    const destination = path.join(output, base);
    await mkdir(destination, { recursive: true });
    await Promise.all(
      builtFiles.map(async (file) => {
        const content = await readFile(path.join(output, file), "utf-8");
        if (base === "base") {
          await writeFile(path.join(destination, file), content);
          return;
        }
        const data: unknown = JSON.parse(content);
        const transformed =
          file === "registry.json"
            ? {
                ...registrySchema.parse(data),
                items: registrySchema
                  .parse(data)
                  .items.map((item) => registryItemForUi(item, base)),
              }
            : registryItemForUi(registryItemSchema.parse(data), base);
        await writeFile(
          path.join(destination, file),
          `${JSON.stringify(transformed, null, JSON_INDENTATION)}\n`
        );
      })
    );
  })
);
