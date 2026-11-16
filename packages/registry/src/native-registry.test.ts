import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RegistryItem } from "shadcn/schema";
import { toolDefinitionSchema } from "../metadata";
import { registry } from "../registry";
import { nativeRegistryItem } from "../native-registry";

const readSources = async (item: RegistryItem) =>
  new Map(
    await Promise.all(
      (item.files ?? []).map(
        async (file) =>
          [
            file.target?.replace(/^~\//u, "") ?? file.path,
            await readFile(
              path.resolve(import.meta.dir, "..", file.path),
              "utf-8"
            ),
          ] as const
      )
    )
  );

test("portable distributions reuse implementation source and exclude app contributions", async () => {
  const portable = await Promise.all(
    registry.items.map(async (item) => {
      if (!toolDefinitionSchema.safeParse(item.meta?.chatjs).data?.native) {
        expect(nativeRegistryItem(item, new Map())).toBeUndefined();
        return null;
      }
      const sources = await readSources(item);
      const native = nativeRegistryItem(item, sources);
      if (!native) {
        throw new Error(`Missing portable item: ${item.name}`);
      }
      expect(native.registryDependencies).toBeUndefined();
      expect(
        native.dependencies?.some((dependency) => dependency.startsWith("eve@"))
      ).toBe(true);
      for (const file of native.files ?? []) {
        expect(file.target).toMatch(/^~\/agent\/(?:tools|lib)\//u);
        expect(file.path).not.toMatch(/renderer|chatjs\.json/u);
        if (!file.path.startsWith("entrypoints/")) {
          expect(file.content).toBe(
            sources.get(file.target?.replace(/^~\//u, "") ?? "") ??
              sources.get(
                `chatjs/tools/${item.name}/${path.basename(file.path)}`
              )
          );
        }
      }
      return native.name;
    })
  );
  expect(portable.filter((name) => name !== null).toSorted()).toEqual([
    "deep-research",
    "get-weather",
    "word-count",
  ]);
});

test.each(["word-count", "deep-research"])(
  "%s cannot borrow ChatJS imports or undeclared packages",
  async (name) => {
    const item = registry.items.find((entry) => entry.name === name);
    if (!item) {
      throw new Error(`Missing ${name}`);
    }
    const sources = await readSources(item);
    for (const content of [
      'import { cost } from "@/lib/eve/tool-usage";',
      'import { thing } from "unlisted-package";',
    ]) {
      expect(() =>
        nativeRegistryItem(
          item,
          new Map([
            ...sources,
            [
              name === "deep-research"
                ? "agent/tools/deepResearch.ts"
                : "chatjs/tools/word-count/tool.ts",
              content,
            ],
          ])
        )
      ).toThrow("dependency");
    }
  }
);
