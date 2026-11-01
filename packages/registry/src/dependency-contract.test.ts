import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import aiPackage from "ai/package.json";
import appPackage from "../../../apps/chat/package.json";
import { registry } from "../registry";
import { assertItemDependencies } from "../dependency-contract";
import { dependencyName } from "@chat-js/registry-validation/ownership";
import {
  coreDependencyNames,
  inheritedRegistryDependencies,
  selectCoreDependencies,
} from "../core-dependencies";

test("core pins the schema helper required by its AI SDK", () => {
  expect(
    selectCoreDependencies(appPackage.dependencies)["@ai-sdk/provider-utils"]
  ).toBe(aiPackage.dependencies["@ai-sdk/provider-utils"]);
});

test("a plugin cannot borrow an undeclared package from core or another selected item", async () => {
  const item = registry.items.find(
    (candidate) => candidate.name === "feedback"
  );
  if (!item) {
    throw new Error("Missing feedback registry fixture");
  }
  const files = new Map(
    await Promise.all(
      (item.files ?? []).map(
        async (file) =>
          [
            file.path,
            await readFile(
              path.resolve(import.meta.dir, "..", file.path),
              "utf-8"
            ),
          ] as const
      )
    )
  );
  expect(coreDependencyNames).toContain("drizzle-orm");
  expect(inheritedRegistryDependencies).not.toContain("drizzle-orm");
  expect(() => {
    assertItemDependencies(item, files);
  }).not.toThrow();
  const broken = {
    ...item,
    dependencies: item.dependencies?.filter(
      (spec) => dependencyName(spec) !== "drizzle-orm"
    ),
  };
  expect(() => {
    assertItemDependencies(broken, files);
  }).toThrow("feedback: undeclared dependency drizzle-orm");
});
