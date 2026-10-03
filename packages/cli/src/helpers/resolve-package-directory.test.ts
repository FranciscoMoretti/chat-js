import { expect, it } from "bun:test";
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

import { resolvePackageDirectory } from "./resolve-package-directory";

// oxlint-disable-next-line typescript/unbound-method -- The fixture passes a receiver-independent mock or arrow callback so invocation identity remains observable.
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
