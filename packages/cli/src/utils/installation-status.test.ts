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
import { recordInstalledSource, sourceBaselineFile } from "./source-receipt";
import { loadSourceFormatter } from "./source-formatter";
import { removePlugins } from "./remove-plugins";

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

test("project formatter classifies formatting without changing receipts or removal protection", async () => {
  const root = await fixture();
  const file = "plugins/alpha/settings.json";
  await put(
    root,
    "plugins/alpha/chatjs.json",
    JSON.stringify({
      contractVersion: 1,
      kind: "plugin",
      id: "alpha",
      files: [file],
    })
  );
  await put(root, file, '{"label":"hello world"}');
  await recordInstalledSource(root, [file, "plugins/alpha/chatjs.json"]);
  await put(root, file, '{ "label": "hello world" }\n');
  await put(
    root,
    "format-source.mjs",
    'export async function formatSource({ path, source }) { return path.endsWith(".json") ? JSON.stringify(JSON.parse(source), null, 2) : null; }'
  );
  const formatSource = await loadSourceFormatter(root, "format-source.mjs");
  const before = await snapshot(root);
  const report = await installationStatus(root, { formatSource });
  expect(
    report.plugins[0]?.files.find((entry) => entry.path === file)?.state
  ).toBe("formatting-only");
  expect(formatInstallationStatus(report, false)).toContain(
    "1 formatting-only"
  );
  const exact = await installationStatus(root);
  expect(
    exact.plugins[0]?.files.find((entry) => entry.path === file)?.state
  ).toBe("modified");
  const child = Bun.spawn(
    [
      process.execPath,
      path.resolve(import.meta.dir, "../index.ts"),
      "status",
      "--cwd",
      root,
      "--format-source",
      "format-source.mjs",
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
  expect(JSON.parse(output)).toEqual(report);
  expect(await snapshot(root)).toEqual(before);
  const plan = await removePlugins(root, ["alpha"], { dryRun: true });
  expect(plan.modified).toContain(file);
  await removePlugins(root, ["alpha"], { backup: true });
  expect(
    JSON.parse(await readFile(path.join(root, sourceBaselineFile), "utf-8"))
  ).toEqual({});
});

test("old or mismatched baselines and invalid UTF-8 cannot be blessed by formatting", async () => {
  const root = await fixture();
  const file = "plugins/alpha/data.json";
  await put(
    root,
    "plugins/alpha/chatjs.json",
    JSON.stringify({
      contractVersion: 1,
      kind: "plugin",
      id: "alpha",
      files: [file],
    })
  );
  await put(root, file, '{"value":1}');
  await recordInstalledSource(root, [file]);
  await put(root, file, '{ "value": 1 }');
  await rm(path.join(root, sourceBaselineFile));
  const state = async () => {
    const report = await installationStatus(root, { formatSource: () => file });
    return report.plugins[0]?.files.find((entry) => entry.path === file);
  };
  expect(await state()).toMatchObject({
    state: "modified",
    formatting: "baseline-unavailable",
  });
  await put(
    root,
    sourceBaselineFile,
    JSON.stringify({ [file]: Buffer.from("wrong baseline").toString("base64") })
  );
  expect(await state()).toMatchObject({
    state: "modified",
    formatting: "baseline-unavailable",
  });
  await writeFile(path.join(root, file), Buffer.from([255]));
  await recordInstalledSource(root, [file]);
  await writeFile(path.join(root, file), Buffer.from([254]));
  expect(await state()).toMatchObject({
    state: "modified",
    formatting: "unsupported",
  });
});
