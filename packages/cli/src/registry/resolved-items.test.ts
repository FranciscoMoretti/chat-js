import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  resolveItemPayload,
  validateResolvedItems,
  installResolvedItems,
} from "./resolved-items";

const root = resolveItemPayload("https://unavailable.test/root.json", {
  name: "root",
  type: "registry:item",
  registryDependencies: ["https://unavailable.test/dependency.json"],
  files: [
    {
      path: "root.ts",
      target: "~/agent/tools/root.ts",
      type: "registry:file",
      content: "export const root = 1;\n",
    },
  ],
});
const dependency = resolveItemPayload(
  "https://unavailable.test/dependency.json",
  {
    name: "dependency",
    type: "registry:item",
    files: [
      {
        path: "dependency.ts",
        target: "~/agent/lib/dependency.ts",
        type: "registry:file",
        content: "export const dependency = 1;\n",
      },
    ],
  }
);

test("resolved installation uses exact transitive source with no available registry", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "chatjs-resolved-test-"));
  try {
    await installResolvedItems([root, dependency], directory, false);
    expect(
      await readFile(path.join(directory, "agent/tools/root.ts"), "utf-8")
    ).toBe("export const root = 1;\n");
    expect(
      await readFile(path.join(directory, "agent/lib/dependency.ts"), "utf-8")
    ).toBe("export const dependency = 1;\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("tampered and incomplete resolutions fail instead of fetching a replacement", () => {
  expect(() => validateResolvedItems([root])).toThrow("missing dependency");
  expect(() => validateResolvedItems([root, dependency, dependency])).toThrow(
    "duplicate"
  );
  expect(() =>
    validateResolvedItems([
      root,
      { ...dependency, item: { ...dependency.item, description: "changed" } },
    ])
  ).toThrow("changed");
});
