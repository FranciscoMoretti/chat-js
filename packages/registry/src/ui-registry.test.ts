import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { selectUiSources } from "../ui-implementations";
import { registry } from "../registry";
import { pluginDefinitionSchema, toolDefinitionSchema } from "../metadata";
import { registryItemForUi } from "../ui-registry";

test.each(["search", "sharing", "projects", "mcp"])(
  "%s declares the native primitives its installed source imports",
  async (name) => {
    const item = registry.items.find((entry) => entry.name === name);
    if (!item) {
      throw new Error(`Missing registry item ${name}`);
    }
    await Promise.all(
      (item.files ?? [])
        .filter((file) => file.path.endsWith(".tsx"))
        .map(async (file) => {
          const source = await readFile(
            path.resolve(import.meta.dir, "..", file.path),
            "utf-8"
          );
          for (const [, primitive] of source.matchAll(
            /@\/components\/ui\/(?<primitive>[a-z-]+)/gu
          )) {
            expect(item.registryDependencies).toContain(primitive);
          }
        })
    );
  }
);

test.each(["base", "radix"] as const)(
  "UI descriptors require an explicit native library: %s",
  (base) => {
    const plugin = { kind: "plugin", id: "custom" };
    const tool = {
      kind: "tool",
      id: "custom",
      tools: [{ toolExport: "customTool" }],
    };
    for (const [schema, definition] of [
      [pluginDefinitionSchema, plugin],
      [toolDefinitionSchema, tool],
    ] as const) {
      expect(
        schema.safeParse({ ...definition, contractVersion: 1, uiBase: base })
          .success
      ).toBe(false);
      expect(
        schema.parse({ ...definition, contractVersion: 2, uiBase: base }).uiBase
      ).toBe(base);
      expect(
        schema.safeParse({ ...definition, contractVersion: 2 }).success
      ).toBe(false);
      expect(
        schema.safeParse({ ...definition, contractVersion: 2, uiBase: "aria" })
          .success
      ).toBe(false);
    }
  }
);

test("native registry variants preserve item identity, dependencies, and descriptor agreement", () => {
  for (const item of registry.items) {
    const metadata: unknown = item.meta?.chatjs;
    if (metadata === undefined) {
      expect(registryItemForUi(item, "radix")).toEqual(item);
      continue;
    }
    const file = {
      path: `dist/source/${item.name}.json`,
      type: "registry:file" as const,
      target: `~/plugins/${item.name}/chatjs.json`,
      content: `${JSON.stringify(metadata, null, 2)}\n`,
    };
    const withDescriptor = { ...item, files: [...(item.files ?? []), file] };
    expect(registryItemForUi(withDescriptor, "base")).toEqual(withDescriptor);
    const radix = registryItemForUi(withDescriptor, "radix");
    expect(radix.name).toBe(item.name);
    expect(radix.registryDependencies).toEqual(item.registryDependencies);
    expect(radix.files?.map((entry) => entry.target)).toEqual(
      withDescriptor.files.map((entry) => entry.target)
    );
    expect(radix.meta?.chatjs).toEqual(
      JSON.parse(radix.files?.at(-1)?.content ?? "null")
    );
  }
});

test("Radix registry selects native boundaries and preserves shared compositions verbatim", async () => {
  const item = registry.items.find((entry) => entry.name === "sharing");
  if (!item) {
    throw new Error(
      "Sharing registry item is required for this contract check"
    );
  }
  const files = await Promise.all(
    (item.files ?? []).map(async (file) => ({
      ...file,
      content: await readFile(
        path.join(import.meta.dir, "..", file.path),
        "utf-8"
      ),
    }))
  );
  const selected = await selectUiSources(
    new Map(
      files.map((file) => [
        file.target?.replace(/^~\//u, "") ?? file.path,
        file.content,
      ])
    ),
    "radix",
    async (entry) =>
      await readFile(
        path.resolve(import.meta.dir, "../../..", entry.radix),
        "utf-8"
      )
  );
  const radix = registryItemForUi({ ...item, files }, "radix", selected);
  const baseButton = files.find((file) =>
    file.path.endsWith("share-button.tsx")
  );
  const radixButton = radix.files?.find((file) =>
    file.path.endsWith("share-button.tsx")
  );
  expect(baseButton?.content).toContain("TriggerButton");
  expect(radixButton?.content).toBe(baseButton?.content);
  const nativeMenu = radix.files?.find((file) =>
    file.path.endsWith("share-menu-surface.tsx")
  );
  expect(nativeMenu?.content).toContain("asChild");
  for (const file of files.filter((entry) => !entry.path.endsWith(".tsx"))) {
    expect(
      radix.files?.find((entry) => entry.path === file.path)?.content
    ).toBe(file.content);
  }
});

test("alternative providers sharing installation targets retain their own source", async () => {
  await Promise.all(
    registry.items
      .filter(
        (item) =>
          item.name.endsWith("-gateway") || item.name.endsWith("-storage")
      )
      .map(async (item) => {
        const files = await Promise.all(
          (item.files ?? []).map(async (file) => ({
            ...file,
            content: await readFile(
              path.join(import.meta.dir, "..", file.path),
              "utf-8"
            ),
          }))
        );
        // A selection map must never replace unrelated provider or shared source.
        const foreignSelection = new Map(
          files.map((file) => [
            file.target?.replace(/^~\//u, "") ?? file.path,
            "foreign provider",
          ])
        );
        const output = registryItemForUi(
          { ...item, files },
          "radix",
          foreignSelection
        );
        expect(output.files).toEqual(files);
      })
  );
});
