import { expect, it } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { resolvePackageDirectory } from "./resolve-package-directory";

it("resolves a non-hoisted package from the workspace that declares it", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-package-resolution-"));
  const app = path.join(root, "apps", "chat");
  const packageDirectory = path.join(
    app,
    "node_modules",
    "@workflow",
    "world-postgres"
  );

  try {
    await mkdir(path.join(packageDirectory, "dist"), { recursive: true });
    await Promise.all([
      writeFile(path.join(app, "package.json"), '{"name":"@chatjs/chat"}\n'),
      writeFile(
        path.join(packageDirectory, "package.json"),
        JSON.stringify({
          exports: { ".": "./dist/index.js" },
          name: "@workflow/world-postgres",
          type: "module",
        })
      ),
      writeFile(
        path.join(packageDirectory, "dist", "index.js"),
        "export {};\n"
      ),
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
