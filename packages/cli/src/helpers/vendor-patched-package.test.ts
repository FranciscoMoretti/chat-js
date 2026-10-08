import { expect, it } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture launches package-manager, Git, or command subprocesses through native process APIs.
import { execFileSync } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture inspects project files using native filesystem APIs.
import { existsSync } from "node:fs";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
/* oxlint-enable sort-imports */
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import nodePath from "node:path";
/* oxlint-enable sort-imports */

import { vendorPatchedPackage } from "./vendor-patched-package";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve the test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
it("refuses to distribute a stale installed runtime", async () => {
  const root = await mkdtemp(
    nodePath.join(tmpdir(), "eve-stale-package-test-")
  );
  try {
    const destination = nodePath.join(root, "app");
    const packageDir = nodePath.join(root, "eve");
    const patchPath = nodePath.join(root, "eve.patch");
    await mkdir(destination);
    await mkdir(packageDir);
    await writeFile(
      nodePath.join(destination, "package.json"),
      JSON.stringify({ dependencies: { eve: "0.52.2" } })
    );
    await writeFile(
      nodePath.join(packageDir, "package.json"),
      JSON.stringify({ name: "eve", version: "0.52.2" })
    );
    await writeFile(nodePath.join(packageDir, "runtime.js"), "original\n");
    await writeFile(
      patchPath,
      "diff --git a/runtime.js b/runtime.js\n--- a/runtime.js\n+++ b/runtime.js\n@@ -1 +1 @@\n-original\n+patched\n"
    );
    expect(
      vendorPatchedPackage({
        destination,
        packageDir,
        packageName: "eve",
        patchPath,
      })
    ).rejects.toThrow();
    expect(
      existsSync(nodePath.join(destination, "vendor/eve-0.52.2.tgz"))
    ).toBe(false);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve each archive case's awaited install and validation sequence. */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
it.each([
  {
    archiveName: "ai-sdk-mcp-2.0.45.tgz",
    name: "@ai-sdk/mcp",
    version: "2.0.45",
  },
  {
    archiveName: "workflow-world-postgres-5.0.0-beta.40.tgz",
    name: "@workflow/world-postgres",
    version: "5.0.0-beta.40",
  },
])(
  "ships the maintained $name archive with compatible metadata",
  async ({ name, version, archiveName }) => {
    const root = await mkdtemp(nodePath.join(tmpdir(), "scoped-package-test-"));
    try {
      const destination = nodePath.join(root, "app");
      const packageDir = nodePath.join(root, "mcp");
      const patchPath = nodePath.join(root, "mcp.patch");
      await mkdir(nodePath.join(packageDir, "dist"), { recursive: true });
      await mkdir(destination);
      await writeFile(
        nodePath.join(destination, "package.json"),
        JSON.stringify({ dependencies: { [name]: version } })
      );
      await writeFile(
        nodePath.join(packageDir, "package.json"),
        JSON.stringify({
          files: ["dist"],
          name,
          version,
        })
      );
      await writeFile(
        nodePath.join(packageDir, "dist", "index.js"),
        "patched\n"
      );
      await writeFile(
        patchPath,
        "diff --git a/dist/index.js b/dist/index.js\n--- a/dist/index.js\n+++ b/dist/index.js\n@@ -1 +1 @@\n-original\n+patched\n"
      );
      await vendorPatchedPackage({
        destination,
        packageDir,
        packageName: name,
        patchPath,
      });
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      const manifest = JSON.parse(
        await readFile(nodePath.join(destination, "package.json"), "utf-8")
      );
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      expect(manifest.dependencies[name]).toBe(`file:vendor/${archiveName}`);
      const archive = nodePath.join(destination, "vendor", archiveName);
      const metadata = execFileSync("tar", [
        "-xOf",
        archive,
        "package/package.json",
      ]);
      expect(JSON.parse(metadata.toString())).toMatchObject({
        name,
        version,
      });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
