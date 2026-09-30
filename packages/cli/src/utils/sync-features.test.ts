import { afterEach, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import ts from "typescript";

import { mcpItem, mcpFiles } from "../../../registry/src/features/mcp";
import { scaffoldFromTemplate } from "../helpers/scaffold";
import { installItems } from "../registry/shadcn";
import { initializeFeatureUi, syncFeatures } from "./sync-features";

const roots: string[] = [];
const demo = path.resolve(import.meta.dir, "../../../../apps/chat");
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});
const fixture = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-feature-"));
  roots.push(root);
  await Promise.all(
    ["composer-controls.ts", "settings-items.ts"].map((file) =>
      cp(path.join(demo, file), path.join(root, file))
    )
  );
  return root;
};
const install = async (root: string) => {
  await Promise.all(
    [...mcpFiles, "features/mcp/chatjs.json"].map(async (file) => {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await cp(path.join(demo, file), path.join(root, file));
    })
  );
};

test("new core UI has no MCP imports; installing MCP registers its router and preserves editable order on sync", async () => {
  const root = await fixture();
  await initializeFeatureUi(root);
  for (const file of [
    "composer-controls.ts",
    "settings-items.ts",
    "features/installed-routers.ts",
  ]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Small fixed set of fixture assertions.
    expect(await readFile(path.join(root, file), "utf-8")).not.toContain(
      "@/features/mcp"
    );
  }
  expect(
    await readFile(path.join(root, "features/installed-routers.ts"), "utf-8")
  ).not.toContain("mcpRouter");
  // Simulate a user's array with a trailing comment and no trailing comma.
  const composer =
    '"use client";\nimport { SearchControl } from "@/components/composer/tool-controls";\nexport const composerControls = [{ Component: SearchControl, id: "search" } // my first control\n];\n';
  await writeFile(path.join(root, "composer-controls.ts"), composer);
  await install(root);
  await syncFeatures(root, { addUi: true, expectedMcp: true });
  const result = await readFile(
    path.join(root, "composer-controls.ts"),
    "utf-8"
  );
  expect(result.startsWith('"use client";')).toBe(true);
  expect(result.indexOf('id: "search"')).toBeLessThan(
    result.indexOf('id: "mcp"')
  );
  expect(result).toContain("// my first control");
  const output = ts.transpileModule(result, { reportDiagnostics: true });
  expect(output.diagnostics).toHaveLength(0);
  expect(
    await readFile(path.join(root, "features/installed-routers.ts"), "utf-8")
  ).toContain("mcp: mcpRouter");
  await syncFeatures(root);
  await syncFeatures(root, { addUi: true });
  expect(await readFile(path.join(root, "composer-controls.ts"), "utf-8")).toBe(
    result
  );
  const settings = await readFile(
    path.join(root, "settings-items.ts"),
    "utf-8"
  );
  expect(settings.match(/mcpSettingsItem,/gu)).toHaveLength(1);
});

test("partial MCP installation cannot register routes", async () => {
  const root = await fixture();
  await initializeFeatureUi(root);
  await install(root);
  await rm(path.join(root, "app/api/mcp/oauth/callback/route.ts"));
  await expect(syncFeatures(root, { expectedMcp: true })).rejects.toThrow();
  expect(
    await readFile(path.join(root, "features/installed-routers.ts"), "utf-8")
  ).not.toContain("mcpRouter");
});

test("shadcn installs MCP into a core-only scaffold with no duplicate demo source", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-mcp-install-"));
  roots.push(root);
  await scaffoldFromTemplate(root);
  const presence = await Promise.all(
    mcpFiles.map((file) => Bun.file(path.join(root, file)).exists())
  );
  expect(presence.some(Boolean)).toBe(false);
  expect(
    await readFile(path.join(root, "lib/db/schema.ts"), "utf-8")
  ).toContain('"McpConnector"');
  const files = await Promise.all(
    (mcpItem.files ?? []).map(async (file) => ({
      ...file,
      content: await readFile(
        path.resolve(import.meta.dir, "../../../registry", file.path),
        "utf-8"
      ),
    }))
  );
  files.push({
    content: JSON.stringify(mcpItem.meta?.chatjs),
    path: "mcp.json",
    target: "~/features/mcp/chatjs.json",
    type: "registry:file",
  });
  const server = Bun.serve({
    fetch: () => Response.json({ ...mcpItem, files }),
    hostname: "127.0.0.1",
    port: 0,
  });
  try {
    await installItems([`http://127.0.0.1:${server.port}/mcp.json`], root);
    await syncFeatures(root, { addUi: true, expectedMcp: true });
    const installed = await Promise.all(
      mcpFiles.map((file) => Bun.file(path.join(root, file)).exists())
    );
    expect(installed.every(Boolean)).toBe(true);
    expect(
      await readFile(path.join(root, "features/installed-routers.ts"), "utf-8")
    ).toContain("mcp: mcpRouter");
  } finally {
    server.stop(true);
  }
});
