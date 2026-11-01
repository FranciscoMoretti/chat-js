import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { assertItemDependencies } from "./dependency-contract";
import { registryDescriptor } from "./descriptor";
import path from "node:path";
import { registry } from "./registry";
import { spawn } from "bun";
import { registryItemSchema, registrySchema } from "shadcn/schema";
import { selectUiSources } from "./ui-implementations";
import { registryItemForUi } from "./ui-registry";

const JSON_INDENTATION = 2;
const SUCCESS_EXIT_CODE = 0;

const cwd = import.meta.dir;
// Select each item independently: alternative providers intentionally share
// installation targets, and must never overwrite one another in a global map.
const selectedItems = new Map(
  await Promise.all(
    registry.items.map(async (item) => {
      const sources = new Map(
        await Promise.all(
          (item.files ?? []).map(
            async (file) =>
              [
                file.target?.replace(/^~\//u, "") ?? file.path,
                await readFile(path.join(cwd, file.path), "utf-8"),
              ] as const
          )
        )
      );
      const selected = new Map(
        await Promise.all(
          (["base", "radix"] as const).map(async (base) => {
            const output = await selectUiSources(
              sources,
              base,
              async (entry) =>
                await readFile(path.resolve(cwd, "../..", entry.radix), "utf-8")
            );
            assertItemDependencies(
              item,
              new Map(
                (item.files ?? []).map((file) => {
                  const target = file.target?.replace(/^~\//u, "") ?? file.path;
                  const content = output.get(target);
                  if (content === undefined) {
                    throw new Error(`Missing selected source: ${target}`);
                  }
                  return [file.path, content];
                })
              )
            );
            return [base, output] as const;
          })
        )
      );
      return [item.name, selected] as const;
    })
  )
);

await rm(path.join(cwd, "dist"), { force: true, recursive: true });
await mkdir(path.join(cwd, "dist/source"), { recursive: true });
await Promise.all(
  registry.items.map(async (item) => {
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
            : registryItemForUi(
                registryItemSchema.parse(data),
                base,
                selectedItems
                  .get(registryItemSchema.parse(data).name)
                  ?.get(base)
              );
        await writeFile(
          path.join(destination, file),
          `${JSON.stringify(transformed, null, JSON_INDENTATION)}\n`
        );
      })
    );
  })
);
