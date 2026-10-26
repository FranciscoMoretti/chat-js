import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { registry } from "../registry";
import { pluginDefinitionSchema, toolDefinitionSchema } from "../metadata";
import { registryItemForUi } from "../ui-registry";

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

test("Radix registry source converts native composition without rewriting unrelated source", async () => {
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
  const radix = registryItemForUi({ ...item, files }, "radix");
  const baseButton = files.find((file) =>
    file.path.endsWith("share-button.tsx")
  );
  const radixButton = radix.files?.find((file) =>
    file.path.endsWith("share-button.tsx")
  );
  expect(baseButton?.content).toContain("render={triggerButton}");
  expect(radixButton?.content).toContain("asChild");
  expect(radixButton?.content).not.toContain("render={triggerButton}");
  for (const file of files.filter((entry) => !entry.path.endsWith(".tsx"))) {
    expect(
      radix.files?.find((entry) => entry.path === file.path)?.content
    ).toBe(file.content);
  }
});
