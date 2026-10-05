import { expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import path from "node:path";

import { vendorPatchedPackage } from "./vendor-patched-package";

const EXIT_SUCCESS = 0;

const manifestSource =
  '{"z_extension":{"keep":"nested"},"dependencies":{"maintained":"1.0.0","unrelated":"^1"},"scripts":{"keep":"command"}}';
const installedSource =
  '{"z_extension":{"source":"preserved"},"files":["runtime.js"],"name":"maintained","peerDependencies":{"external":"^1"},"version":"1.0.0"}';
const pinnedManifest = `{
  "z_extension": {
    "keep": "nested"
  },
  "dependencies": {
    "maintained": "file:vendor/maintained-1.0.0.tgz",
    "unrelated": "^1"
  },
  "scripts": {
    "keep": "command"
  }
}
`;

const createFixture = async (
  installed = installedSource
): Promise<{
  destination: string;
  packageDir: string;
  patchPath: string;
  root: string;
}> => {
  const root = await mkdtemp(path.join(tmpdir(), "vendor-json-contract-"));
  const destination = path.join(root, "app");
  const packageDir = path.join(root, "package");
  const patchPath = path.join(root, "maintained.patch");
  await Promise.all([mkdir(destination), mkdir(packageDir)]);
  await Promise.all([
    writeFile(path.join(destination, "package.json"), manifestSource),
    writeFile(path.join(packageDir, "package.json"), installed),
    writeFile(path.join(packageDir, "runtime.js"), "patched\n"),
    writeFile(
      patchPath,
      "diff --git a/runtime.js b/runtime.js\n--- a/runtime.js\n+++ b/runtime.js\n@@ -1 +1 @@\n-original\n+patched\n"
    ),
  ]);
  return { destination, packageDir, patchPath, root };
};

test("retains template and published package metadata while pinning the maintained archive", async () => {
  const fixture = await createFixture();
  try {
    await vendorPatchedPackage({ ...fixture, packageName: "maintained" });
    expect(
      await readFile(path.join(fixture.destination, "package.json"), "utf-8")
    ).toBe(pinnedManifest);
    const child = Bun.spawn(
      [
        "tar",
        "-xOf",
        path.join(fixture.destination, "vendor/maintained-1.0.0.tgz"),
        "package/package.json",
      ],
      { stderr: "pipe", stdout: "pipe" }
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(exitCode).toBe(EXIT_SUCCESS);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toEqual(JSON.parse(installedSource));
  } finally {
    await rm(fixture.root, { force: true, recursive: true });
  }
});

for (const installed of [
  "[]",
  '{"name":"maintained","version":"different"}',
  '{"name":"maintained","version":true}',
]) {
  test(`retains the version guard before publishing malformed or mismatched metadata ${installed}`, async () => {
    const fixture = await createFixture(installed);
    try {
      try {
        await vendorPatchedPackage({ ...fixture, packageName: "maintained" });
        throw new Error("Expected a metadata mismatch.");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toMatchObject({
          message: "The template and installed maintained versions must match.",
        });
      }
      expect(
        await readFile(path.join(fixture.destination, "package.json"), "utf-8")
      ).toBe(manifestSource);
      expect(
        await Bun.file(
          path.join(fixture.destination, "vendor/maintained-1.0.0.tgz")
        ).exists()
      ).toBe(false);
    } finally {
      await rm(fixture.root, { force: true, recursive: true });
    }
  });
}
