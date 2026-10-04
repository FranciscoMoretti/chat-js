import { afterEach, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import ts from "typescript";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { mcpItem, mcpFiles } from "../../../registry/src/features/mcp";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { scaffoldFromTemplate } from "../helpers/scaffold";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { installItems } from "../registry/shadcn";
/* oxlint-enable import/no-relative-parent-imports */
import { installPlan } from "./install-plan";
import { planInstallation } from "./installation-plan";
/* oxlint-disable import/max-dependencies -- The feature installation contract exercises the real planner, installer, registry and scaffold together. */
import { initializeFeatureUi, syncFeatures } from "./sync-features";
/* oxlint-enable import/max-dependencies */

const roots: string[] = [];
const demo = path.resolve(import.meta.dir, "../../../../apps/chat");
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
afterEach(async (): Promise<void> => {
  await Promise.all(
    roots
      .splice(0)
      .map((root): Promise<void> => rm(root, { force: true, recursive: true }))
  );
});
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const fixture = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-feature-"));
  roots.push(root);
  await Promise.all(
    ["composer-controls.ts", "settings-items.ts"].map((file): Promise<void> =>
      cp(path.join(demo, file), path.join(root, file))
    )
  );
  return root;
};
/* oxlint-enable typescript/promise-function-async */
const install = async (root: string): Promise<void> => {
  await Promise.all(
    [...mcpFiles, "features/mcp/chatjs.json"].map(
      async (file): Promise<void> => {
        await mkdir(path.dirname(path.join(root, file)), { recursive: true });
        await writeFile(
          path.join(root, file),
          file === "features/mcp/chatjs.json"
            ? JSON.stringify(mcpItem.meta?.chatjs)
            : await readFile(
                path.resolve(
                  import.meta.dir,
                  "../../../registry/src/features/mcp",
                  file
                ),
                "utf-8"
              )
        );
      }
    )
  );
};

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
test("new core UI has no MCP imports; installing MCP registers its router and preserves editable order on sync", async (): Promise<void> => {
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
  const customizedSettings =
    'import { Settings } from "lucide-react";\nexport const settingsItems = [{ id: "custom-first", label: "Custom", href: "/settings/custom", icon: Settings }, { id: "custom-second", label: "Other", href: "/settings/other", icon: Settings }];\n';
  await writeFile(path.join(root, "settings-items.ts"), customizedSettings);
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
  expect(settings).toContain('id: "custom-first"');
  expect(settings).toContain('id: "custom-second"');
  expect(settings.indexOf('id: "custom-first"')).toBeLessThan(
    settings.indexOf('id: "custom-second"')
  );
  expect(settings.indexOf('id: "custom-second"')).toBeLessThan(
    settings.indexOf("mcpSettingsItem,")
  );
  expect(settings.match(/mcpSettingsItem,/gu)).toHaveLength(1);
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

test("partial MCP installation cannot register routes", async (): Promise<void> => {
  const root = await fixture();
  await initializeFeatureUi(root);
  await install(root);
  await rm(path.join(root, "app/api/mcp/oauth/callback/route.ts"));
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
  await expect(syncFeatures(root, { expectedMcp: true })).rejects.toThrow(
    "app/api/mcp/oauth/callback/route.ts"
  );
  expect(
    await readFile(path.join(root, "features/installed-routers.ts"), "utf-8")
  ).not.toContain("mcpRouter");
});
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
test("MCP installation requires the approval schema before changing an older scaffold", async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-mcp-install-"));
  roots.push(root);
  await scaffoldFromTemplate(root);
  const presence = await Promise.all(
    mcpFiles.map((file): Promise<boolean> =>
      Bun.file(path.join(root, file)).exists()
    )
  );
  expect(presence.some(Boolean)).toBe(false);
  expect(
    await Bun.file(path.join(root, "lib/eve/mcp-adapter.test.ts")).exists()
  ).toBe(false);
  expect(
    await readFile(path.join(root, "lib/db/schema.ts"), "utf-8")
  ).toContain('"McpConnector"');
  const files = await Promise.all(
    // oxlint-disable-next-line oxc/no-map-spread -- #541: Load file contents into independent installation fixtures without mutating registry metadata.
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
    const schemaFile = path.join(root, "lib/db/schema.ts");
    const schema = await readFile(schemaFile, "utf-8");
    const oldSchema = schema.replace(
      '    requireApproval: boolean("requireApproval").notNull().default(false),\n',
      ""
    );
    expect(oldSchema).not.toContain("requireApproval");
    await writeFile(schemaFile, oldSchema);
    const plan = await planInstallation(root, {
      features: [],
      tools: [`http://127.0.0.1:${server.port}/mcp.json`],
    });
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await Bun's asynchronous rejection matcher before checking for writes.
    await expect(
      installPlan(root, plan, { overwrite: true }, (): Promise<void> =>
        Promise.reject(
          new Error("registration must not run before the schema upgrade")
        )
      )
    ).rejects.toThrow("bun db:generate");
    expect(
      await Bun.file(path.join(root, "trpc/routers/mcp.router.ts")).exists()
    ).toBe(false);
    expect(await readFile(schemaFile, "utf-8")).toBe(oldSchema);
    await writeFile(schemaFile, schema);
    await installPlan(root, plan, {}, async (): Promise<void> => {
      await syncFeatures(root, { addUi: true, expectedMcp: true });
    });
    const installed = await Promise.all(
      mcpFiles.map((file): Promise<boolean> =>
        Bun.file(path.join(root, file)).exists()
      )
    );
    expect(installed.every(Boolean)).toBe(true);
    expect(
      await readFile(path.join(root, "features/installed-routers.ts"), "utf-8")
    ).toContain("mcp: mcpRouter");
  } finally {
    // oxlint-disable-next-line typescript/no-floating-promises -- The test intentionally starts this operation before inspecting intermediate state; its completion is controlled by the surrounding fixture.
    server.stop(true);
  }
}, 30_000);
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
for (const [importText, entry] of [
  [
    'import { ConnectorsControl } from "@/features/mcp/composer";',
    "ConnectorsControl",
  ],
  [
    'import { ConnectorsControl as MyConnectors } from "@/features/mcp/composer";',
    "MyConnectors",
  ],
  [
    'import * as connectors from "@/features/mcp/composer";',
    "connectors.ConnectorsControl",
  ],
] as const) {
  test(`restores a removed UI entry using ${entry} without duplicate imports`, async (): Promise<void> => {
    const root = await fixture();
    await initializeFeatureUi(root);
    await install(root);
    await writeFile(
      path.join(root, "composer-controls.ts"),
      `${importText}\nexport const composerControls = [];\n`
    );
    await syncFeatures(root, { addUi: true });
    const content = await readFile(
      path.join(root, "composer-controls.ts"),
      "utf-8"
    );
    expect(content).toContain(`Component: ${entry}`);
    expect(content.match(/@\/features\/mcp\/composer/gu)).toHaveLength(1);
    await syncFeatures(root, { addUi: true });
    expect(
      await readFile(path.join(root, "composer-controls.ts"), "utf-8")
    ).toBe(content);
  });
}
/* oxlint-enable eslint/no-magic-numbers */

test("preserves an existing contribution with a custom import", async (): Promise<void> => {
  const root = await fixture();
  await initializeFeatureUi(root);
  await install(root);
  const content =
    'import { Custom } from "./custom";\nexport const composerControls = [{ id: "mcp", Component: Custom }];\n';
  await writeFile(path.join(root, "composer-controls.ts"), content);
  await syncFeatures(root, { addUi: true });
  expect(await readFile(path.join(root, "composer-controls.ts"), "utf-8")).toBe(
    content
  );
});

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
for (const file of ["composer-controls.ts", "settings-items.ts"]) {
  test(`an unsupported ${file} leaves both UI files and registrations unchanged`, async (): Promise<void> => {
    const root = await fixture();
    await initializeFeatureUi(root);
    await install(root);
    const name =
      file === "composer-controls.ts" ? "composerControls" : "settingsItems";
    await writeFile(
      path.join(root, file),
      `export const ${name} = makeItems();\n`
    );
    const paths = [
      "composer-controls.ts",
      "settings-items.ts",
      "features/installed.ts",
      "features/installed-routers.ts",
    ];
    const before = await Promise.all(
      paths.map((entry): Promise<string> =>
        readFile(path.join(root, entry), "utf-8")
      )
    );
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(syncFeatures(root, { addUi: true })).rejects.toThrow(
      "retry chat-js add"
    );
    expect(
      await Promise.all(
        paths.map((entry): Promise<string> =>
          readFile(path.join(root, entry), "utf-8")
        )
      )
    ).toEqual(before);
  });
}
/* oxlint-enable typescript/promise-function-async */

test("missing descriptors report partial MCP source and how to recover", async (): Promise<void> => {
  const root = await fixture();
  await initializeFeatureUi(root);
  await install(root);
  await rm(path.join(root, "features/mcp/chatjs.json"));
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
  await expect(syncFeatures(root)).rejects.toThrow("chat-js add mcp");
});

test("empty feature registration uses a zero-argument Set constructor", async (): Promise<void> => {
  const root = await fixture();
  await initializeFeatureUi(root);
  expect(
    await readFile(path.join(root, "features/installed.ts"), "utf-8")
  ).toContain("new Set()");
});

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
test("adds the requested binding when the module already has another named import", async (): Promise<void> => {
  const root = await fixture();
  await initializeFeatureUi(root);
  await install(root);
  await writeFile(
    path.join(root, "composer-controls.ts"),
    'import { other } from "@/features/mcp/composer";\nexport const composerControls = [];\n'
  );
  await writeFile(
    path.join(root, "settings-items.ts"),
    'import { mcpSettingsItem as connectors } from "@/features/mcp/settings";\nexport const settingsItems = [];\n'
  );
  await syncFeatures(root, { addUi: true });
  const composer = await readFile(
    path.join(root, "composer-controls.ts"),
    "utf-8"
  );
  expect(composer).toMatch(/other,\s+ConnectorsControl/u);
  expect(composer.match(/@\/features\/mcp\/composer/gu)).toHaveLength(1);
  expect(
    await readFile(path.join(root, "settings-items.ts"), "utf-8")
  ).toContain("  connectors,");
});
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
test("core scaffold omits uploads; shadcn add registers uploads alongside MCP and sync preserves user order", async (): Promise<void> => {
  const { attachmentUploadsItem, attachmentUploadFiles } =
    await import("../../../registry/src/features/attachment-uploads");
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-upload-install-"));
  roots.push(root);
  await scaffoldFromTemplate(root);
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ dependencies: {}, name: "upload-fixture" })
  );
  const uploadPresence = await Promise.all(
    attachmentUploadFiles.map((file): Promise<boolean> =>
      Bun.file(path.join(root, file)).exists()
    )
  );
  expect(uploadPresence.some(Boolean)).toBe(false);
  expect(
    await readFile(path.join(root, "features/installed-uploads.ts"), "utf-8")
  ).not.toContain("@/features/attachment-uploads");
  for (const file of [
    "components/context-bar.tsx",
    "lib/file-storage.ts",
    "lib/db/eve-files.ts",
    "lib/eve/restore-message-attachments.ts",
  ]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Assert a small fixed set of historical-file core seams.
    expect(await Bun.file(path.join(root, file)).exists()).toBe(true);
  }
  const files = await Promise.all(
    // oxlint-disable-next-line oxc/no-map-spread -- #541: Load file contents into independent installation fixtures without mutating registry metadata.
    (attachmentUploadsItem.files ?? []).map(async (file) => ({
      ...file,
      content: await readFile(
        path.resolve(import.meta.dir, "../../../registry", file.path),
        "utf-8"
      ),
    }))
  );
  files.push({
    content: JSON.stringify(attachmentUploadsItem.meta?.chatjs),
    path: "uploads.json",
    target: "~/features/attachment-uploads/chatjs.json",
    type: "registry:file",
  });
  const server = Bun.serve({
    fetch: () => Response.json({ ...attachmentUploadsItem, files }),
    hostname: "127.0.0.1",
    port: 0,
  });
  try {
    await installItems(
      [`http://127.0.0.1:${server.port}/attachment-uploads.json`],
      root
    );
    await install(root);
    await syncFeatures(root, {
      addUi: true,
      expectedMcp: true,
      expectedUploads: true,
    });
    const composer = await readFile(
      path.join(root, "composer-controls.ts"),
      "utf-8"
    );
    expect(composer).toContain("...attachmentUploads.controls");
    expect(composer).toContain("ConnectorsControl");
    expect(
      await readFile(path.join(root, "features/installed.ts"), "utf-8")
    ).toContain('"attachment-uploads"');
    expect(
      await readFile(path.join(root, "features/installed-uploads.ts"), "utf-8")
    ).toContain("@/features/attachment-uploads/integration");
    const reordered = composer.replace(
      "...attachmentUploads.controls",
      "...attachmentUploads.controls /* user placement */"
    );
    await writeFile(path.join(root, "composer-controls.ts"), reordered);
    await syncFeatures(root, { addUi: true });
    expect(
      await readFile(path.join(root, "composer-controls.ts"), "utf-8")
    ).toBe(reordered);
    for (const controls of [
      '{ Component: AttachFilesControl, id: "attach-files" }, { Component: TakePhotoControl, id: "take-photo" }',
      '{ Component: AttachFilesControl, id: "attach-files" }',
      '{ Component: TakePhotoControl, id: "take-photo" }',
    ]) {
      const customControls = composer.replace(
        "...attachmentUploads.controls",
        controls
      );
      // oxlint-disable-next-line eslint/no-await-in-loop -- Verify each app-owned placement independently.
      await writeFile(path.join(root, "composer-controls.ts"), customControls);
      // oxlint-disable-next-line eslint/no-await-in-loop -- Sync must preserve the selected control subset.
      await syncFeatures(root, { addUi: true, expectedMcp: true });
      expect(
        // oxlint-disable-next-line eslint/no-await-in-loop -- Compare the exact app-owned source after sync.
        await readFile(path.join(root, "composer-controls.ts"), "utf-8")
      ).toBe(customControls);
    }
    await rm(path.join(root, "app/(chat)/api/files/upload/route.ts"));
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(syncFeatures(root, { expectedUploads: true })).rejects.toThrow(
      "app/(chat)/api/files/upload/route.ts"
    );
  } finally {
    // oxlint-disable-next-line typescript/no-floating-promises -- The test intentionally starts this operation before inspecting intermediate state; its completion is controlled by the surrounding fixture.
    server.stop(true);
  }
}, 30_000);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
test("unrelated additions preserve computed feature UI; requesting MCP still requires manual composition", async (): Promise<void> => {
  const root = await fixture();
  await initializeFeatureUi(root);
  await install(root);
  const composer = "export const composerControls = getUserControls();\n";
  const settings = "export const settingsItems = getUserSettings();\n";
  await writeFile(path.join(root, "composer-controls.ts"), composer);
  await writeFile(path.join(root, "settings-items.ts"), settings);
  await syncFeatures(root, { addUi: [] });
  expect(await readFile(path.join(root, "composer-controls.ts"), "utf-8")).toBe(
    composer
  );
  expect(await readFile(path.join(root, "settings-items.ts"), "utf-8")).toBe(
    settings
  );
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
  await expect(syncFeatures(root, { addUi: ["mcp"] })).rejects.toThrow(
    "manually"
  );
});
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
