import { constants } from "node:fs";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

const base = path.resolve("apps/chat/.eve");
const checkout = path.resolve(base, "lane-c-runtime");
const packageRoot = path.resolve(base, "lane-c-deps/node_modules/eve");
const manifestText = await readFile(
  path.resolve(packageRoot, "package.json"),
  "utf-8"
);
z.object({ version: z.literal("0.71.3") }).parse(JSON.parse(manifestText));
const patch = await readFile(
  "experiments/eve-delivery-correlation/runtime.patch",
  "utf-8"
);
const transpiler = new Bun.Transpiler({ loader: "ts", target: "node" });
await Promise.all(
  [
    ...patch.matchAll(/^\+\+\+ b\/(?<relative>packages\/eve\/src\/.+\.ts)$/gmu),
  ].map(async ([, relative]) => {
    const target = path.resolve(
      packageRoot,
      relative
        .replace("packages/eve/src/", "dist/src/")
        .replace(/\.ts$/u, ".js")
    );
    const backup = path.resolve(base, "lane-c-original", `${relative}.js`);
    await mkdir(path.dirname(backup), { recursive: true });
    try {
      await copyFile(target, backup, constants.COPYFILE_EXCL);
    } catch (error) {
      if (
        !(
          error instanceof Error &&
          "code" in error &&
          typeof error.code === "string" &&
          ["EEXIST", "ENOENT"].includes(error.code)
        )
      ) {
        throw error;
      }
    }
    const compiled = await transpiler.transform(
      await readFile(path.resolve(checkout, relative), "utf-8")
    );
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, compiled);
  })
);
