import { expect, it } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { resolvePackageDirectory } from "./resolve-package-directory";

const { join } = path;

it("resolves a non-hoisted package from the workspace that declares it", async () => {
  const root = await mkdtemp(join(tmpdir(), "chatjs-package-resolution-"));
  const app = join(root, "apps", "chat");
  const packageDirectory = join(
    app,
    "node_modules",
    "@workflow",
    "world-postgres"
  );

  try {
    await mkdir(join(packageDirectory, "dist"), { recursive: true });
    await Promise.all([
      writeFile(join(app, "package.json"), '{"name":"@chatjs/chat"}\n'),
      writeFile(
        join(packageDirectory, "package.json"),
        JSON.stringify({
          exports: { ".": "./dist/index.js" },
          name: "@workflow/world-postgres",
          type: "module",
        })
      ),
      writeFile(join(packageDirectory, "dist", "index.js"), "export {};\n"),
    ]);

    expect(
      await realpath(
        await resolvePackageDirectory("@workflow/world-postgres", app)
      )
    ).toBe(await realpath(packageDirectory));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
