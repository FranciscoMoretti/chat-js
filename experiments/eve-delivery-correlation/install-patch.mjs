import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
const base = resolve("apps/chat/.eve");
const checkout = resolve(base, "lane-c-runtime");
const packageRoot = resolve(base, "lane-c-deps/node_modules/eve");
const manifest = JSON.parse(
  await readFile(resolve(packageRoot, "package.json"), "utf8")
);
if (manifest.version !== "0.71.3") throw new Error("Expected exact eve 0.71.3");
const patch = await readFile(
  "experiments/eve-delivery-correlation/runtime.patch",
  "utf8"
);
const transpiler = new Bun.Transpiler({ loader: "ts", target: "node" });
for (const [, relative] of patch.matchAll(
  /^\+\+\+ b\/(packages\/eve\/src\/.+\.ts)$/gm
)) {
  const target = resolve(
    packageRoot,
    relative.replace("packages/eve/src/", "dist/src/").replace(/\.ts$/, ".js")
  );
  const backup = resolve(base, "lane-c-original", relative + ".js");
  await mkdir(dirname(backup), { recursive: true });
  try {
    await copyFile(target, backup, 1);
  } catch (error) {
    if (!["EEXIST", "ENOENT"].includes(error.code)) throw error;
  }
  const compiled = transpiler.transformSync(
    await readFile(resolve(checkout, relative), "utf8")
  );
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, compiled);
}
