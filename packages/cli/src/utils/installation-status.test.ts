import { rejects } from "node:assert/strict";
import { afterEach, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { directoryFiles } from "./installation-files";
import {
  installationStatus,
  formatInstallationStatus,
} from "./installation-status";
import { recordInstalledSource } from "./source-receipt";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => {
      await rm(root, { recursive: true, force: true });
    })
  );
});
const fixture = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-status-"));
  roots.push(root);
  await mkdir(path.join(root, "plugins/alpha"), { recursive: true });
  return root;
};
const put = async (root: string, file: string, source: string) => {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), source);
};
const snapshot = async (root: string) => {
  const files = await directoryFiles(root, ".");
  return new Map(
    await Promise.all(
      files.map(
        async (file) =>
          [file, await readFile(path.join(root, file), "utf-8")] as const
      )
    )
  );
};

test("status identifies edits, missing files, local files, framework ownership and removal dependencies without writes", async () => {
  const root = await fixture();
  const files = [
    "plugins/alpha/source.ts",
    "plugins/alpha/missing.ts",
    "app/api/alpha/route.ts",
  ];
  await put(
    root,
    "plugins/alpha/chatjs.json",
    JSON.stringify({ contractVersion: 1, kind: "plugin", id: "alpha", files })
  );
  await Promise.all(
    files.map(async (file) => {
      await put(root, file, "export const value = 1;\n");
    })
  );
  await recordInstalledSource(root, [...files, "plugins/alpha/chatjs.json"]);
  await put(root, files[0], "export const value = 2;\n");
  await rm(path.join(root, files[1]));
  await put(root, "plugins/alpha/local.ts", "export const local = true;\n");
  await put(
    root,
    "plugins/beta/chatjs.json",
    JSON.stringify({
      contractVersion: 1,
      kind: "plugin",
      id: "beta",
      files: [],
      requiresPlugins: ["alpha"],
    })
  );
  await put(
    root,
    "integrations/local.ts",
    'export { value } from "@/plugins/alpha/source";\n'
  );
  await put(
    root,
    "chatjs/generated/installed.ts",
    'export { value } from "@/plugins/alpha/source";\n'
  );
  const before = await snapshot(root);
  const report = await installationStatus(root);
  const alpha = report.plugins.find((plugin) => plugin.id === "alpha");
  expect(alpha?.files.find((file) => file.path === files[0])).toMatchObject({
    state: "modified",
  });
  expect(alpha?.files.find((file) => file.path === files[1])).toMatchObject({
    state: "missing",
  });
  expect(alpha?.files.find((file) => file.path === files[2])).toMatchObject({
    state: "unchanged",
    outsidePluginDirectory: true,
  });
  expect(
    alpha?.files.find((file) => file.path === "plugins/alpha/local.ts")
  ).toMatchObject({ state: "untracked" });
  expect(alpha?.requiredBy).toEqual(["beta"]);
  expect(alpha?.removalReferences).toEqual([
    { file: "integrations/local.ts", target: files[0] },
  ]);
  expect(report.generated).toEqual(["chatjs/generated/installed.ts"]);
  expect(formatInstallationStatus(report, false)).toContain(
    "plugin-owned framework file"
  );
  const child = Bun.spawn(
    [
      process.execPath,
      path.resolve(import.meta.dir, "../index.ts"),
      "status",
      "--cwd",
      root,
      "--json",
    ],
    { stdout: "pipe", stderr: "pipe" }
  );
  const [output, error, exit] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ exit, error }).toEqual({ exit: 0, error: "" });
  expect(output).toBe(`${JSON.stringify(report, null, 2)}\n`);
  expect(await snapshot(root)).toEqual(before);
});

test("native installs without receipts stay untracked, and status reports missing schemas", async () => {
  const root = await fixture();
  await put(
    root,
    "plugins/alpha/chatjs.json",
    JSON.stringify({
      contractVersion: 1,
      kind: "plugin",
      id: "alpha",
      files: ["plugins/alpha/schema.ts"],
      databaseSchemas: ["plugins/alpha/schema.ts"],
    })
  );
  const before = await snapshot(root);
  const report = await installationStatus(root);
  expect(
    report.plugins[0]?.files.find(
      (file) => file.path === "plugins/alpha/chatjs.json"
    )
  ).toMatchObject({ state: "untracked" });
  expect(
    report.plugins[0]?.files.find(
      (file) => file.path === "plugins/alpha/schema.ts"
    )
  ).toMatchObject({ state: "missing" });
  expect(report.plugins[0]?.removalIssue).toBeDefined();
  expect(await snapshot(root)).toEqual(before);
});

test("status refuses symlinked plugin source instead of reading outside the project", async () => {
  const root = await fixture();
  await put(
    root,
    "plugins/alpha/chatjs.json",
    JSON.stringify({
      contractVersion: 1,
      kind: "plugin",
      id: "alpha",
      files: ["plugins/alpha/source.ts"],
    })
  );
  await symlink(
    path.join(root, "plugins/alpha/chatjs.json"),
    path.join(root, "plugins/alpha/source.ts")
  );
  await rejects(installationStatus(root), /symlinked ChatJS target/u);
});
