import { rejects } from "node:assert/strict";
import { expect, test } from "bun:test";
import { mkdtemp, writeFile, rm, readdir, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { assertUiCompatibility } from "./ui-compatibility";
import { installPlan } from "./install-plan";
import {
  pluginDefinitionSchema,
  toolDefinitionSchema,
} from "../../../registry/metadata";

test("plugin and tool descriptors validate their own contract versions", () => {
  const plugin = { id: "custom", kind: "plugin", files: [] };
  expect(
    pluginDefinitionSchema.parse({ ...plugin, contractVersion: 3 })
      .contractVersion
  ).toBe(3);
  expect(
    pluginDefinitionSchema.safeParse({
      ...plugin,
      contractVersion: 1,
      uiBase: "base",
    }).success
  ).toBe(false);
  expect(
    pluginDefinitionSchema.safeParse({ ...plugin, contractVersion: 2 }).success
  ).toBe(false);
  expect(
    pluginDefinitionSchema.parse({
      ...plugin,
      contractVersion: 3,
      uiBase: "base",
    }).uiBase
  ).toBe("base");
  const tool = {
    id: "custom",
    kind: "tool",
    tools: [{ toolExport: "custom" }],
  };
  expect(
    toolDefinitionSchema.safeParse({ ...tool, contractVersion: 2 }).success
  ).toBe(false);
  expect(
    toolDefinitionSchema.parse({ ...tool, contractVersion: 2, uiBase: "base" })
      .uiBase
  ).toBe("base");
});

test.each(["new-york", "radix-rhea", "aria-rhea", undefined])(
  "rejects Base UI source before installer or registration writes to %s",
  async (style) => {
    const root = await mkdtemp(path.join(tmpdir(), "chatjs-ui-boundary-"));
    try {
      if (style !== undefined) {
        await writeFile(
          path.join(root, "components.json"),
          JSON.stringify({ style })
        );
      }
      const before = await readdir(root);
      const plugin = pluginDefinitionSchema.parse({
        id: "base-plugin",
        kind: "plugin",
        contractVersion: 3,
        uiBase: "base",
      });
      let registered = false;
      await rejects(
        installPlan(
          root,
          {
            environmentVariables: [],
            expected: [],
            plugins: [plugin],
            items: [],
            providerChanges: [],
            replacements: [],
            selection: { plugins: [], tools: [] },
            resolvedItems: [],
            sources: [],
          },
          { overwrite: true },
          async () => {
            await writeFile(
              path.join(root, "registration.ts"),
              "unexpected write"
            );
            registered = true;
          }
        ),
        /No source or registrations were written/u
      );
      expect(registered).toBe(false);
      expect(await readdir(root)).toEqual(before);
      await assertUiCompatibility(root, [{ id: "legacy-plugin" }]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
);

test("sync validates Base UI plugins before regenerating tool registrations", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-ui-sync-"));
  try {
    await mkdir(path.join(root, "chatjs/plugins/base-plugin"), {
      recursive: true,
    });
    await writeFile(
      path.join(root, "components.json"),
      JSON.stringify({ style: "new-york" })
    );
    await writeFile(
      path.join(root, "chatjs/plugins/base-plugin/chatjs.json"),
      JSON.stringify({
        contractVersion: 3,
        uiBase: "base",
        id: "base-plugin",
        kind: "plugin",
        files: [],
      })
    );
    const child = Bun.spawn(
      [
        process.execPath,
        path.join(import.meta.dir, "../index.ts"),
        "sync",
        "--cwd",
        root,
      ],
      { stdout: "pipe", stderr: "pipe" }
    );
    const [exitCode, stderr, stdout] = await Promise.all([
      child.exited,
      new Response(child.stderr).text(),
      new Response(child.stdout).text(),
    ]);
    expect(exitCode).toBe(1);
    expect(stderr + stdout).toContain(
      "No source or registrations were written"
    );
    const entries = await readdir(root);
    expect(entries.toSorted()).toEqual(["chatjs", "components.json"]);
    await writeFile(
      path.join(root, "components.json"),
      JSON.stringify({ style: "base-rhea" })
    );
    await assertUiCompatibility(root, [{ id: "base-plugin", uiBase: "base" }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Radix descriptors require Radix and cannot be mixed with Base descriptors", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-radix-boundary-"));
  try {
    await writeFile(
      path.join(root, "components.json"),
      JSON.stringify({ style: "radix-rhea" })
    );
    const plugin = pluginDefinitionSchema.parse({
      id: "radix-plugin",
      kind: "plugin",
      contractVersion: 3,
      uiBase: "radix",
    });
    await assertUiCompatibility(root, [plugin]);
    await rejects(
      assertUiCompatibility(root, [
        plugin,
        { id: "base-plugin", uiBase: "base" },
      ]),
      /No source or registrations were written/u
    );
    await writeFile(
      path.join(root, "components.json"),
      JSON.stringify({ style: "base-rhea" })
    );
    await rejects(
      assertUiCompatibility(root, [plugin]),
      /No source or registrations were written/u
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
