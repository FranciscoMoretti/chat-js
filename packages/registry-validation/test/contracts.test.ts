import { expect, test } from "bun:test";
import { auditDependencies, compareProjects } from "../src/index";

const bytes = (source: string) => new TextEncoder().encode(source);

test("ownership cannot borrow another item's declaration or an implicit host alias", () => {
  const owner = {
    name: "notes",
    files: [{ path: "notes.ts" }],
    dependencies: ["zod@4.5.4"],
  };
  const sources = new Map([
    [
      "notes.ts",
      'import { z } from "zod"; import { cache } from "cache-package/subpath"; import { shared } from "@/shared";',
    ],
  ]);
  expect(
    auditDependencies(owner, sources).map((item) => item.dependency)
  ).toEqual(["cache-package", "@/shared"]);
  expect(
    auditDependencies(owner, sources, {
      inheritedPackages: ["cache-package"],
      localImportPrefixes: ["@/"],
    })
  ).toEqual([]);
  expect(auditDependencies(owner, new Map())[0]?.code).toBe("missing-source");
});

test("parity detects complete inventory and binary changes with explicit symmetric normalization", async () => {
  const expected = new Map([
    ["missing.ts", bytes("x")],
    ["same.ts", bytes("x")],
    ["format.ts", bytes(" x ")],
    ["asset.bin", new Uint8Array([0, 255])],
  ]);
  const actual = new Map([
    ["unexpected.ts", bytes("x")],
    ["same.ts", bytes("x")],
    ["format.ts", bytes("x")],
    ["asset.bin", new Uint8Array([0, 254])],
  ]);
  expect(
    await compareProjects(expected, actual, {
      normalize: (file, content) =>
        file === "format.ts"
          ? bytes(new TextDecoder().decode(content).trim())
          : content,
    })
  ).toEqual([
    { file: "asset.bin", kind: "changed", offset: 1 },
    { file: "missing.ts", kind: "missing" },
    { file: "unexpected.ts", kind: "unexpected" },
  ]);
  expect(
    await compareProjects(
      new Map([["prefix", bytes("x")]]),
      new Map([["prefix", bytes("xy")]])
    )
  ).toEqual([{ file: "prefix", kind: "changed", offset: 1 }]);
  expect(
    await compareProjects(
      new Map([["metadata.json", bytes("null")]]),
      new Map([["metadata.json", bytes(" null ")]]),
      {
        normalize: (_file, content): unknown =>
          JSON.parse(new TextDecoder().decode(content)),
      }
    )
  ).toEqual([]);
});
