import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";
import { expect, test } from "bun:test";
import { classifyImport, inventoryFiles, targetPath } from "./file-ownership";
import { installationItems, itemClaims } from "./installation-ownership";
import {
  localImports,
  localImportTarget,
  resolveImports,
} from "./ownership-imports";
import { demoInstallation } from "../installation";
import { registry } from "../registry";
import { shouldCopyChatAppFile } from "../../cli/src/helpers/scaffold-content";
import { crossingStatus } from "./ownership-policy";

test("ownership follows explicit targets even outside plugin directories", () => {
  const inventory = inventoryFiles(
    ["lib/auth.ts", "app/api/plugin/route.ts"],
    [
      {
        owner: "plugin",
        source: "src/plugin/route.ts",
        target: "~/app/api/plugin/route.ts",
      },
    ]
  );
  expect(inventory).toEqual([
    {
      path: "app/api/plugin/route.ts",
      kind: "installable",
      owners: ["plugin"],
      sources: ["src/plugin/route.ts"],
    },
    { path: "lib/auth.ts", kind: "core", owners: [], sources: [] },
  ]);
});

test("session identity ships with core even when MCP and research are omitted", () => {
  const claims = installationItems(registry.items, demoInstallation).flatMap(
    itemClaims
  );
  const identity = "lib/eve/session-identity.ts";
  const record = inventoryFiles([identity], claims).find(
    (file) => file.path === identity
  );
  expect(record?.kind).toBe("core");
  expect(record?.owners).toEqual([]);
  expect(shouldCopyChatAppFile(identity)).toBe(true);
});

test("shared and missing targets remain visible instead of losing an owner", () => {
  expect(
    inventoryFiles(
      [],
      [
        { owner: "mcp", source: "identity.ts", target: "~/lib/identity.ts" },
        {
          owner: "research",
          source: "identity.ts",
          target: "~/lib/identity.ts",
        },
      ]
    )
  ).toEqual([
    {
      path: "lib/identity.ts",
      kind: "installable",
      owners: ["mcp", "research"],
      sources: ["identity.ts"],
    },
  ]);
});

test("targets cannot escape the application or disguise ownership", () => {
  for (const target of [
    "../secret",
    "~/../secret",
    "/secret",
    "C:\\secret",
    "C:/secret",
    "folder//file",
    "",
    "./file",
  ]) {
    expect(() => targetPath(target)).toThrow("Invalid installation target");
  }
});

test("selecting a provider does not claim alternative providers", () => {
  const items = installationItems(
    [
      {
        name: "chosen-gateway",
        type: "registry:item",
        registryDependencies: ["dropdown-menu", "@chatjs/shared"],
      },
      { name: "other-gateway", type: "registry:item" },
      {
        name: "shared",
        type: "registry:item",
        registryDependencies: ["@chatjs/chosen-gateway"],
      },
    ],
    { gateway: "chosen", plugins: [], tools: [] }
  );
  expect(items.map((item) => item.name)).toEqual(["chosen-gateway", "shared"]);
  expect(() =>
    installationItems([], { gateway: "unknown", plugins: [], tools: [] })
  ).toThrow("Unknown local registry item");
});

test("plugin descriptors are owned and implicit shadcn targets fail explicitly", () => {
  expect(
    itemClaims({
      name: "mcp",
      type: "registry:item",
      meta: { chatjs: { kind: "plugin" } },
    })
  ).toEqual([
    {
      owner: "mcp",
      source: "descriptor:mcp",
      target: "chatjs/plugins/mcp/chatjs.json",
    },
  ]);
  expect(() =>
    itemClaims({
      name: "implicit",
      type: "registry:item",
      files: [{ path: "unknown.ts", type: "registry:component" }],
    })
  ).toThrow("Missing explicit target");
});

test("crossings preserve direction and distinguish another installable", () => {
  const core = {
    path: "core.ts",
    kind: "core" as const,
    owners: [],
    sources: [],
  };
  const plugin = {
    path: "plugin.ts",
    kind: "installable" as const,
    owners: ["plugin"],
    sources: [],
  };
  const other = { ...plugin, path: "other.ts", owners: ["other"] };
  expect(classifyImport(core, plugin)).toBe("core-to-installable");
  expect(classifyImport(plugin, core)).toBe("installable-to-core");
  expect(classifyImport(plugin, other)).toBe("cross-installable");
  expect(classifyImport(plugin, plugin)).toBeNull();
  expect(classifyImport(core, core)).toBeNull();
  expect(crossingStatus(plugin, other, false, [])).toBe("needs-review");
  expect(
    crossingStatus(plugin, other, false, [
      {
        name: "plugin",
        type: "registry:item",
        registryDependencies: ["@chatjs/other"],
      },
    ])
  ).toBe("declared-dependency");
  expect(crossingStatus(plugin, core, false, [])).toBe("needs-review");
  expect(
    crossingStatus(
      plugin,
      { ...core, path: "lib/eve/session-identity.ts" },
      false,
      []
    )
  ).toBe("public-core-contract");
});

test("static, type-only, re-export and lazy dependencies are inspected without parsing comments", () => {
  const source = `
    // import hidden from '@/not-an-import';
    import type { A } from '@/contracts';
    export { value } from './internal';
    const lazy = import('./lazy');
    type Value = import('./types').Value;
    const module = require('./required');
    import external from 'react';
  `;
  expect(localImports(source, "fixture.ts")).toEqual([
    "@/contracts",
    "./internal",
    "./lazy",
    "./types",
    "./required",
  ]);
});

test("Windows import targets match inventory keys and retain local-only filtering", () => {
  const inventory = inventoryFiles(["lib/core.ts", "styles/theme.css"], []);
  const paths = new Set(inventory.map((file) => file.path));
  expect(paths.has(localImportTarget("lib\\core.ts") ?? "")).toBe(true);
  expect(paths.has(localImportTarget("styles\\theme.css") ?? "")).toBe(true);
  for (const external of [
    "D:\\external\\outside.ts",
    "/external/outside.ts",
    "../outside.ts",
    "..\\outside.ts",
    "..",
    "node_modules\\pkg\\index.ts",
    "nested/node_modules/pkg/index.ts",
  ]) {
    expect(localImportTarget(external)).toBeUndefined();
  }
});

test("resolver emits inventory-compatible edges and excludes outside modules", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "chatjs-imports-"));
  const root = path.join(temporary, "app");
  try {
    await mkdir(path.join(root, "lib"), { recursive: true });
    await Promise.all([
      writeFile(path.join(root, "lib/core.ts"), "export const value = 1;"),
      writeFile(path.join(root, "lib/theme.css"), "body {}"),
      writeFile(path.join(temporary, "outside.ts"), "export const value = 2;"),
    ]);
    const result = resolveImports(
      path.join("lib", "entry.ts"),
      `
      import { value } from "./core";
      import "./theme.css";
      import { value as outside } from "../../outside";
    `,
      root,
      { moduleResolution: ts.ModuleResolutionKind.Bundler }
    );
    expect(result).toEqual({
      edges: [
        { from: "lib/entry.ts", to: "lib/core.ts" },
        { from: "lib/entry.ts", to: "lib/theme.css" },
      ],
      unresolved: [],
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
