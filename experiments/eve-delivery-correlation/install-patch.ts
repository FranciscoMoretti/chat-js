// oxlint-disable-next-line import/no-nodejs-modules -- This isolated runtime proof owns disposable files, process controls and Node assertions.
import { constants } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules -- This isolated runtime proof owns disposable files, process controls and Node assertions.
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- This isolated runtime proof owns disposable files, process controls and Node assertions.
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
for (const [, relative] of patch.matchAll(
  /^\+\+\+ b\/(?<relative>packages\/eve\/src\/.+\.ts)$/gmu
)) {
  const target = path.resolve(
    packageRoot,
    relative.replace("packages/eve/src/", "dist/src/").replace(/\.ts$/u, ".js")
  );
  const backup = path.resolve(base, "lane-c-original", `${relative}.js`);
  // oxlint-disable-next-line eslint/no-await-in-loop -- The bounded proof observes ordered runtime state; parallel polling or command dispatch would change the scenario.
  await mkdir(path.dirname(backup), { recursive: true });
  try {
    // oxlint-disable-next-line eslint/no-await-in-loop -- The bounded proof observes ordered runtime state; parallel polling or command dispatch would change the scenario.
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
  // oxlint-disable-next-line eslint/no-await-in-loop -- The bounded proof observes ordered runtime state; parallel polling or command dispatch would change the scenario.
  const compiled = await transpiler.transform(
    // oxlint-disable-next-line eslint/no-await-in-loop -- The bounded proof observes ordered runtime state; parallel polling or command dispatch would change the scenario.
    await readFile(path.resolve(checkout, relative), "utf-8")
  );
  // oxlint-disable-next-line eslint/no-await-in-loop -- The bounded proof observes ordered runtime state; parallel polling or command dispatch would change the scenario.
  await mkdir(path.dirname(target), { recursive: true });
  // oxlint-disable-next-line eslint/no-await-in-loop -- The bounded proof observes ordered runtime state; parallel polling or command dispatch would change the scenario.
  await writeFile(target, compiled);
}
