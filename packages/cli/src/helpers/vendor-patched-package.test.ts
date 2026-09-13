import { expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";

import { vendorPatchedPackage } from "./vendor-patched-package";

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
    await expect(
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

it.each([
  {
    archiveName: "ai-sdk-mcp-2.0.45.tgz",
    name: "@ai-sdk/mcp",
    version: "2.0.45",
  },
  { archiveName: "eve-0.52.2.tgz", name: "eve", version: "0.52.2" },
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
          peerDependencies: name === "eve" ? { microsandbox: "^0.5.0" } : {},
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
      const manifest = JSON.parse(
        await readFile(nodePath.join(destination, "package.json"), "utf-8")
      );
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
      if (name === "eve") {
        expect(
          JSON.parse(metadata.toString()).peerDependencies.microsandbox
        ).toBe("^0.6.18");
      }
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  }
);
