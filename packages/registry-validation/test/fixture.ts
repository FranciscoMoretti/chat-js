import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";
import zodPackage from "zod/package.json";

/** Isolated dependencies outside the workspace, with no application imports. */
export const createDependencyFixture = async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "validation-dependencies-")
  );
  const require = createRequire(import.meta.url);
  const dispose = async (): Promise<void> => {
    await rm(directory, { recursive: true, force: true });
  };
  try {
    await mkdir(path.join(directory, "node_modules/fixture-provider"), {
      recursive: true,
    });
    await Promise.all(
      ["typescript", "zod"].map(async (name) => {
        await cp(
          path.dirname(require.resolve(`${name}/package.json`)),
          path.join(directory, "node_modules", name),
          { recursive: true }
        );
      })
    );
    await writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({
        name: "isolated-validator-fixture",
        version: "1.0.0",
        dependencies: {
          typescript: ts.version,
          zod: zodPackage.version,
          "fixture-provider": "1.0.0",
        },
      })
    );
    await writeFile(
      path.join(directory, "node_modules/fixture-provider/package.json"),
      JSON.stringify({
        name: "fixture-provider",
        version: "1.0.0",
        types: "index.d.ts",
        dependencies: { zod: zodPackage.version },
      })
    );
    await writeFile(
      path.join(directory, "node_modules/fixture-provider/index.d.ts"),
      'import { z } from "zod"; export declare const schema: z.ZodString;'
    );
    await writeFile(
      path.join(directory, "checkout-only.ts"),
      "export const hidden = true;"
    );
    return { directory, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
};
