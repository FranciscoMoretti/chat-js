import { creditsItem } from "../../../registry/src/plugins/credits/manifest";
import { modelPreferencesItem } from "../../../registry/src/plugins/model-preferences/manifest";
import { searchItem } from "../../../registry/src/plugins/search/manifest";
import { projectsItem } from "../../../registry/src/plugins/projects/manifest";
import { feedbackItem } from "../../../registry/src/plugins/feedback/manifest";
import { followupSuggestionsItem } from "../../../registry/src/plugins/followup-suggestions/manifest";
import { rejects } from "node:assert/strict";
import { afterEach, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

import path from "node:path";
import { tmpdir } from "node:os";

import ts from "typescript";

import { scaffoldFromTemplate } from "#cli/helpers/scaffold";

import { installItems } from "#cli/registry/shadcn";

import { mcpFiles, mcpItem } from "../../../registry/src/plugins/mcp/manifest";

import { installPlan } from "./install-plan";
import { planInstallation } from "./installation-plan";

import { initializePluginUi, syncPlugins } from "./sync-plugins";

const roots: string[] = [];
const demo = path.resolve(import.meta.dir, "../../../../apps/chat");
afterEach(async (): Promise<void> => {
  await Promise.all(
    roots.splice(0).map(async (root): Promise<void> => {
      await rm(root, { force: true, recursive: true });
    })
  );
});
const fixture = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-plugin-"));
  roots.push(root);
  await Promise.all(
    ["composer-controls.ts", "settings-items.ts", "components.json"].map(
      async (file): Promise<void> => {
        await cp(path.join(demo, file), path.join(root, file));
      }
    )
  );
  return root;
};
const registrationDiagnostics = (root: string, name: string): string[] => {
  const program = ts.createProgram({
    rootNames: [path.join(root, `composition/generated/installed-${name}.ts`)],
    options: {
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      paths: { "@/*": [`${root}/*`], react: [`${root}/lib/react.ts`] },
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ESNext,
      types: [],
    },
  });
  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
    );
};
const runRegistration = async (
  root: string,
  name: string,
  assertions: string
): Promise<{ exitCode: number; stderr: string }> => {
  const tsconfig = path.join(root, "tsconfig.json");
  await writeFile(
    tsconfig,
    JSON.stringify({ compilerOptions: { paths: { "@/*": [`${root}/*`] } } })
  );
  const build = await Bun.build({
    entrypoints: [
      path.join(root, `composition/generated/installed-${name}.ts`),
    ],
    target: "bun",
    tsconfig,
  });
  expect(build.success).toBe(true);
  const source = await build.outputs[0]?.text();
  expect(source).toBeString();
  await writeFile(path.join(root, "compiled-registration.mjs"), source ?? "");
  const runner = path.join(root, "check-registration.mjs");
  await writeFile(
    runner,
    `import { strict as assert } from "node:assert";\nimport * as registration from "./compiled-registration.mjs";\n${assertions}`
  );
  const result = Bun.spawnSync([process.execPath, runner]);
  return { exitCode: result.exitCode, stderr: result.stderr.toString() };
};
const install = async (root: string): Promise<void> => {
  await Promise.all(
    (mcpItem.files ?? []).map(async (file) => {
      const target = path.join(root, file.target?.replace(/^~\//u, "") ?? "");
      await mkdir(path.dirname(target), { recursive: true });
      await cp(
        path.resolve(import.meta.dir, "../../../registry", file.path),
        target
      );
    })
  );
  await writeFile(
    path.join(root, "plugins/mcp/chatjs.json"),
    JSON.stringify(mcpItem.meta?.chatjs)
  );
};
test("new core UI has no MCP imports; installing MCP registers its router and preserves editable order on sync", async (): Promise<void> => {
  const root = await fixture();
  await initializePluginUi(root);
  await Promise.all(
    [
      "composer-controls.ts",
      "settings-items.ts",
      "composition/generated/installed-routers.ts",
    ].map(async (file) => {
      expect(await readFile(path.join(root, file), "utf-8")).not.toContain(
        "@/plugins/mcp"
      );
    })
  );
  expect(
    await readFile(
      path.join(root, "composition/generated/installed-routers.ts"),
      "utf-8"
    )
  ).not.toContain("mcpRouter");
  // Simulate a user's array with a trailing comment and no trailing comma.
  const composer =
    '"use client";\nimport { SearchControl } from "@/components/composer/tool-controls";\nexport const composerControls = [{ Component: SearchControl, id: "search" } // my first control\n];\n';
  await writeFile(path.join(root, "composer-controls.ts"), composer);
  const customizedSettings =
    'import { Settings } from "lucide-react";\nexport const settingsItems = [{ id: "custom-first", label: "Custom", href: "/settings/custom", icon: Settings }, { id: "custom-second", label: "Other", href: "/settings/other", icon: Settings }];\n';
  await writeFile(path.join(root, "settings-items.ts"), customizedSettings);
  await install(root);
  await syncPlugins(root, { addUi: true, expected: ["mcp"] });
  const result = await readFile(
    path.join(root, "composer-controls.ts"),
    "utf-8"
  );
  expect(result.startsWith('"use client";')).toBe(true);
  expect(result.indexOf('id: "search"')).toBeLessThan(
    result.indexOf("...mcpClient().composerControls")
  );
  expect(result).toContain("// my first control");
  const output = ts.transpileModule(result, { reportDiagnostics: true });
  expect(output.diagnostics).toHaveLength(0);
  expect(
    await readFile(
      path.join(root, "composition/generated/installed-routers.ts"),
      "utf-8"
    )
  ).toContain("mcp: plugin0().routers.mcp");
  await syncPlugins(root);
  await syncPlugins(root, { addUi: true });
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
    settings.indexOf("...mcpClient().settingsItems,")
  );
  expect(settings.match(/\.\.\.mcpClient\(\)\.settingsItems,/gu)).toHaveLength(
    1
  );
});

test("partial MCP installation cannot register routes", async (): Promise<void> => {
  const root = await fixture();
  await initializePluginUi(root);
  await install(root);
  await rm(path.join(root, "app/api/mcp/oauth/callback/route.ts"));
  await rejects(syncPlugins(root, { expected: ["mcp"] }), (reason: unknown) => {
    expect(() => {
      throw reason;
    }).toThrow("app/api/mcp/oauth/callback/route.ts");
    return true;
  });
  expect(
    await readFile(
      path.join(root, "composition/generated/installed-routers.ts"),
      "utf-8"
    )
  ).not.toContain("mcpRouter");
});

test("MCP installation contributes its schema without modifying core tables", async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-mcp-install-"));
  roots.push(root);
  await scaffoldFromTemplate(root);
  const presence = await Promise.all(
    mcpFiles.map(
      async (file): Promise<boolean> =>
        await Bun.file(path.join(root, file)).exists()
    )
  );
  expect(presence.some(Boolean)).toBe(false);
  expect(
    await Bun.file(path.join(root, "lib/eve/mcp-adapter.test.ts")).exists()
  ).toBe(false);
  expect(
    await readFile(path.join(root, "lib/db/schema.ts"), "utf-8")
  ).not.toContain('"McpConnector"');
  const files = await Promise.all(
    (mcpItem.files ?? []).map(
      async (file: Readonly<NonNullable<typeof mcpItem.files>[number]>) => ({
        ...file,
        content: await readFile(
          path.resolve(import.meta.dir, "../../../registry", file.path),
          "utf-8"
        ),
      })
    )
  );
  files.push({
    content: JSON.stringify(mcpItem.meta?.chatjs),
    path: "mcp.json",
    target: "~/plugins/mcp/chatjs.json",
    type: "registry:file",
  });
  const server = Bun.serve({
    // This fixture checks source/schema composition; packaged integration tests install dependencies.
    fetch: () =>
      Response.json({
        ...mcpItem,
        files,
        dependencies: [],
        devDependencies: [],
      }),
    hostname: "127.0.0.1",
    port: 0,
  });
  try {
    const schemaFile = path.join(root, "lib/db/schema.ts");
    const schema = await readFile(schemaFile, "utf-8");
    const plan = await planInstallation(root, {
      plugins: [],
      tools: [`http://127.0.0.1:${server.port}/mcp.json`],
    });
    await installPlan(root, plan, {}, async (): Promise<void> => {
      await syncPlugins(root, { addUi: true, expected: ["mcp"] });
    });
    const installed = await Promise.all(
      mcpFiles.map(
        async (file): Promise<boolean> =>
          await Bun.file(path.join(root, file)).exists()
      )
    );
    expect(installed.every(Boolean)).toBe(true);
    expect(await readFile(schemaFile, "utf-8")).toBe(schema);
    expect(
      await readFile(
        path.join(root, "composition/generated/installed-database.ts"),
        "utf-8"
      )
    ).toContain("plugins/mcp/db/mcp-schema.ts");
    expect(
      await readFile(
        path.join(root, "composition/generated/installed-routers.ts"),
        "utf-8"
      )
    ).toContain("mcp: plugin0().routers.mcp");
  } finally {
    await server.stop(true);
  }
}, 30_000);

for (const [importText, entry] of [
  ['import { mcpClient } from "@/plugins/mcp/client-plugin";', "mcpClient"],
  [
    'import { mcpClient as MyConnectors } from "@/plugins/mcp/client-plugin";',
    "MyConnectors",
  ],
  [
    'import * as connectors from "@/plugins/mcp/client-plugin";',
    "connectors.mcpClient",
  ],
] as const) {
  test(`restores a removed UI entry using ${entry} without duplicate imports`, async (): Promise<void> => {
    const root = await fixture();
    await initializePluginUi(root);
    await install(root);
    await writeFile(
      path.join(root, "composer-controls.ts"),
      `${importText}\nexport const composerControls = [];\n`
    );
    await syncPlugins(root, { addUi: true });
    const content = await readFile(
      path.join(root, "composer-controls.ts"),
      "utf-8"
    );
    expect(content).toContain(`...${entry}().composerControls`);
    expect(content.match(/@\/plugins\/mcp\/client/gu)).toHaveLength(1);
    await syncPlugins(root, { addUi: true });
    expect(
      await readFile(path.join(root, "composer-controls.ts"), "utf-8")
    ).toBe(content);
  });
}

test("preserves an existing contribution with a custom import", async (): Promise<void> => {
  const root = await fixture();
  await initializePluginUi(root);
  await install(root);
  const content =
    'import { Custom } from "./custom";\nexport const composerControls = [{ id: "mcp", Component: Custom }];\n';
  await writeFile(path.join(root, "composer-controls.ts"), content);
  await syncPlugins(root, { addUi: true });
  expect(await readFile(path.join(root, "composer-controls.ts"), "utf-8")).toBe(
    content
  );
});
for (const file of ["composer-controls.ts", "settings-items.ts"]) {
  test(`an unsupported ${file} leaves both UI files and registrations unchanged`, async (): Promise<void> => {
    const root = await fixture();
    await initializePluginUi(root);
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
      "composition/generated/installed.ts",
      "composition/generated/installed-routers.ts",
    ];
    const before = await Promise.all(
      paths.map(
        async (entry): Promise<string> =>
          await readFile(path.join(root, entry), "utf-8")
      )
    );
    await rejects(syncPlugins(root, { addUi: true }), (reason: unknown) => {
      expect(() => {
        throw reason;
      }).toThrow("retry chat-js add");
      return true;
    });
    expect(
      await Promise.all(
        paths.map(
          async (entry): Promise<string> =>
            await readFile(path.join(root, entry), "utf-8")
        )
      )
    ).toEqual(before);
  });
}

test("missing descriptors report partial MCP source and how to recover", async (): Promise<void> => {
  const root = await fixture();
  await initializePluginUi(root);
  await install(root);
  await rm(path.join(root, "plugins/mcp/chatjs.json"));
  await rejects(syncPlugins(root), (reason: unknown) => {
    expect(() => {
      throw reason;
    }).toThrow("chat-js add mcp");
    return true;
  });
});
test("empty plugin registration uses a zero-argument Set constructor", async (): Promise<void> => {
  const root = await fixture();
  await initializePluginUi(root);
  expect(
    await readFile(
      path.join(root, "composition/generated/installed.ts"),
      "utf-8"
    )
  ).toContain("new Set()");
});
test("adds the requested binding when the module already has another named import", async (): Promise<void> => {
  const root = await fixture();
  await initializePluginUi(root);
  await install(root);
  await writeFile(
    path.join(root, "composer-controls.ts"),
    'import { other } from "@/plugins/mcp/client-plugin";\nexport const composerControls = [];\n'
  );
  await writeFile(
    path.join(root, "settings-items.ts"),
    'import { mcpClient as connectors } from "@/plugins/mcp/client-plugin";\nexport const settingsItems = [];\n'
  );
  await syncPlugins(root, { addUi: true });
  const composer = await readFile(
    path.join(root, "composer-controls.ts"),
    "utf-8"
  );
  expect(composer).toMatch(/other,\s+mcpClient/u);
  expect(composer.match(/@\/plugins\/mcp\/client/gu)).toHaveLength(1);
  expect(
    await readFile(path.join(root, "settings-items.ts"), "utf-8")
  ).toContain("...connectors().settingsItems,");
});

test("core scaffold omits uploads; shadcn add registers uploads alongside MCP and sync preserves user order", async (): Promise<void> => {
  const { attachmentUploadsItem, attachmentUploadFiles } =
    await import("../../../registry/src/plugins/attachment-uploads/manifest");
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-upload-install-"));
  roots.push(root);
  await scaffoldFromTemplate(root);
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ dependencies: {}, name: "upload-fixture" })
  );
  const uploadPresence = await Promise.all(
    attachmentUploadFiles.map(
      async (file): Promise<boolean> =>
        await Bun.file(path.join(root, file)).exists()
    )
  );
  expect(uploadPresence.some(Boolean)).toBe(false);
  expect(
    await readFile(
      path.join(root, "composition/generated/installed-uploads.ts"),
      "utf-8"
    )
  ).not.toContain("@/plugins/attachment-uploads");
  await Promise.all(
    [
      "components/context-bar.tsx",
      "lib/file-storage.ts",
      "lib/db/eve-files.ts",
      "lib/eve/restore-message-attachments.ts",
    ].map(async (file) => {
      expect(await Bun.file(path.join(root, file)).exists()).toBe(true);
    })
  );
  const files = await Promise.all(
    (attachmentUploadsItem.files ?? []).map(
      async (
        file: Readonly<NonNullable<typeof attachmentUploadsItem.files>[number]>
      ) => ({
        ...file,
        content: await readFile(
          path.resolve(import.meta.dir, "../../../registry", file.path),
          "utf-8"
        ),
      })
    )
  );
  files.push({
    content: JSON.stringify(attachmentUploadsItem.meta?.chatjs),
    path: "uploads.json",
    target: "~/plugins/attachment-uploads/chatjs.json",
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
    await syncPlugins(root, {
      addUi: true,
      expected: ["mcp", "attachment-uploads"],
    });
    const composer = await readFile(
      path.join(root, "composer-controls.ts"),
      "utf-8"
    );
    expect(composer).toContain("...attachmentUploadsClient().composerControls");
    expect(composer).toContain("mcpClient");
    expect(
      await readFile(
        path.join(root, "composition/generated/installed.ts"),
        "utf-8"
      )
    ).toContain('"attachment-uploads"');
    expect(
      await readFile(
        path.join(root, "composition/generated/installed-uploads.ts"),
        "utf-8"
      )
    ).toContain("@/plugins/attachment-uploads/client-plugin");
    const reordered = composer.replace(
      "...attachmentUploadsClient().composerControls",
      "...attachmentUploadsClient().composerControls /* user placement */"
    );
    await writeFile(path.join(root, "composer-controls.ts"), reordered);
    await syncPlugins(root, { addUi: true });
    expect(
      await readFile(path.join(root, "composer-controls.ts"), "utf-8")
    ).toBe(reordered);
    for (const controls of [
      '{ Component: AttachFilesControl, id: "attach-files" }, { Component: TakePhotoControl, id: "take-photo" }',
      '{ Component: AttachFilesControl, id: "attach-files" }',
      '{ Component: TakePhotoControl, id: "take-photo" }',
    ]) {
      const customControls = composer.replace(
        "...attachmentUploadsClient().composerControls",
        controls
      );
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each case replaces composer-controls.ts in the same fixture; finish the prior sync/read before writing the next subset.
      await writeFile(path.join(root, "composer-controls.ts"), customControls);
      // oxlint-disable-next-line eslint/no-await-in-loop -- Sync the subset just written before checking its source or replacing it with the next case.
      await syncPlugins(root, { addUi: true, expected: ["mcp"] });
      expect(
        // oxlint-disable-next-line eslint/no-await-in-loop -- Read this subset's synced source before the next iteration overwrites the shared composer file.
        await readFile(path.join(root, "composer-controls.ts"), "utf-8")
      ).toBe(customControls);
    }
    await rm(path.join(root, "app/(chat)/api/files/upload/route.ts"));
    await rejects(
      syncPlugins(root, { expected: ["attachment-uploads"] }),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("app/(chat)/api/files/upload/route.ts");
        return true;
      }
    );
  } finally {
    await server.stop(true);
  }
}, 30_000);

test("unrelated additions preserve computed plugin UI; requesting MCP still requires manual composition", async (): Promise<void> => {
  const root = await fixture();
  await initializePluginUi(root);
  await install(root);
  const composer = "export const composerControls = getUserControls();\n";
  const settings = "export const settingsItems = getUserSettings();\n";
  await writeFile(path.join(root, "composer-controls.ts"), composer);
  await writeFile(path.join(root, "settings-items.ts"), settings);
  await syncPlugins(root, { addUi: [] });
  expect(await readFile(path.join(root, "composer-controls.ts"), "utf-8")).toBe(
    composer
  );
  expect(await readFile(path.join(root, "settings-items.ts"), "utf-8")).toBe(
    settings
  );
  await rejects(syncPlugins(root, { addUi: ["mcp"] }), (reason: unknown) => {
    expect(() => {
      throw reason;
    }).toThrow("manually");
    return true;
  });
});

test("third-party plugins contribute without CLI changes or executing their server entrypoint", async () => {
  const root = await fixture();
  await initializePluginUi(root);
  const directory = path.join(root, "plugins/team-notes");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "chatjs.json"),
    JSON.stringify({
      contractVersion: 1,
      id: "team-notes",
      kind: "plugin",
      server: { export: "teamNotes", routers: ["notes"] },
      client: {
        export: "teamNotesClient",
        composerControls: ["team-notes"],
        settingsItems: ["team-notes"],
      },
    })
  );
  // Sync inspects metadata only. Loading the server to discover contributions
  // would require deployment credentials and could execute arbitrary side effects.
  await writeFile(
    path.join(directory, "server-plugin.ts"),
    'throw new Error("Do not evaluate server code during sync");'
  );
  await writeFile(
    path.join(directory, "client-plugin.ts"),
    "export const teamNotesClient = () => ({ id: 'team-notes', composerControls: [], settingsItems: [] });"
  );
  await syncPlugins(root, { addUi: true, expected: ["team-notes"] });
  const routers = await readFile(
    path.join(root, "composition/generated/installed-routers.ts"),
    "utf-8"
  );
  expect(routers).toContain('from "@/plugins/team-notes/server-plugin"');
  expect(routers).toContain("notes: plugin0().routers.notes");
  const composer = await readFile(
    path.join(root, "composer-controls.ts"),
    "utf-8"
  );
  expect(composer).toContain("...teamNotesClient().composerControls");
  expect(composer).not.toContain("/server");
  await syncPlugins(root, { addUi: true });
  expect(await readFile(path.join(root, "composer-controls.ts"), "utf-8")).toBe(
    composer
  );
});

for (const key of ["eve"]) {
  test(`plugin router ${key} cannot replace a core router or partially edit UI`, async () => {
    const root = await fixture();
    await initializePluginUi(root);
    const before = await readFile(
      path.join(root, "composer-controls.ts"),
      "utf-8"
    );
    await mkdir(path.join(root, "plugins/conflict"), { recursive: true });
    await writeFile(path.join(root, "plugins/conflict/server-plugin.ts"), "");
    await writeFile(
      path.join(root, "plugins/conflict/chatjs.json"),
      JSON.stringify({
        contractVersion: 1,
        id: "conflict",
        kind: "plugin",
        server: { export: "conflict", routers: [key] },
      })
    );
    expect(syncPlugins(root, { addUi: true })).rejects.toThrow(
      "Duplicate or reserved plugin router"
    );
    expect(
      await readFile(path.join(root, "composer-controls.ts"), "utf-8")
    ).toBe(before);
    expect(
      await readFile(
        path.join(root, "composition/generated/installed-routers.ts"),
        "utf-8"
      )
    ).not.toContain("conflict");
  });
}

for (const [contribution, ids] of [
  [
    "composerControls",
    ["canvas", "web-search", "deep-research", "image", "video"],
  ],
  ["settingsItems", ["general"]],
] as const) {
  for (const id of ids) {
    test(`plugin ${contribution} cannot claim core id ${id}`, async () => {
      const root = await fixture();
      await initializePluginUi(root);
      const before = await readFile(
        path.join(root, "composition/generated/installed.ts"),
        "utf-8"
      );
      await mkdir(path.join(root, "plugins/conflict"), { recursive: true });
      await writeFile(path.join(root, "plugins/conflict/client-plugin.ts"), "");
      await writeFile(
        path.join(root, "plugins/conflict/chatjs.json"),
        JSON.stringify({
          contractVersion: 1,
          id: "conflict",
          kind: "plugin",
          client: { export: "conflictClient", [contribution]: [id] },
        })
      );
      await rejects(
        syncPlugins(root, { addUi: true }),
        /Duplicate or reserved plugin/u
      );
      expect(
        await readFile(
          path.join(root, "composition/generated/installed.ts"),
          "utf-8"
        )
      ).toBe(before);
    });
  }
}

test.each([
  {
    item: modelPreferencesItem,
    router: "modelPreferences",
    schema: "model-preferences-schema.ts",
  },
  { item: projectsItem, router: "project", schema: "db/project-schema.ts" },
  { item: feedbackItem, router: "feedback", schema: "feedback-schema.ts" },
  { item: searchItem, router: "search", schema: "search-schema.ts" },
  {
    item: followupSuggestionsItem,
    router: "followupSuggestions",
    schema: "followup-schema.ts",
  },
])(
  "optional plugin $router installs independently of the other chat plugins",
  async ({ item, router, schema }) => {
    const root = await fixture();
    await initializePluginUi(root);
    const uninstalled = await Promise.all(
      ["installed-chat", "installed-chat-ui", "installed-database"].map(
        async (name) =>
          await readFile(
            path.join(root, `composition/generated/${name}.ts`),
            "utf-8"
          )
      )
    );
    for (const source of uninstalled) {
      expect(source).not.toContain("plugins/");
    }
    await Promise.all(
      (item.files ?? []).map(async (file) => {
        const target = path.join(root, file.target?.replace(/^~\//u, "") ?? "");
        await mkdir(path.dirname(target), { recursive: true });
        await cp(
          path.resolve(import.meta.dir, "../../../registry", file.path),
          target
        );
      })
    );
    await writeFile(
      path.join(root, `plugins/${item.name}/chatjs.json`),
      JSON.stringify(item.meta?.chatjs)
    );
    await syncPlugins(root, { expected: [item.name] });
    const lifecycle = await readFile(
      path.join(root, "composition/generated/installed-chat.ts"),
      "utf-8"
    );
    if (item.name === "model-preferences") {
      expect(lifecycle).not.toContain("@/plugins/");
      const visibility = await readFile(
        path.join(root, "composition/generated/installed-model-visibility.ts"),
        "utf-8"
      );
      expect(visibility).toContain("plugin0().useModelVisibility");
      expect(visibility).toContain("@/plugins/model-preferences/client-plugin");
    } else {
      expect(lifecycle).toContain(`@/plugins/${item.name}/chat`);
    }
    expect(lifecycle).not.toContain("server-plugin");
    expect(lifecycle).not.toContain("routers");
    expect(
      await readFile(
        path.join(root, "composition/generated/installed-routers.ts"),
        "utf-8"
      )
    ).toContain(`${router}: plugin0().routers.${router}`);
    expect(
      await readFile(
        path.join(root, "composition/generated/installed-database.ts"),
        "utf-8"
      )
    ).toContain(`plugins/${item.name}/${schema}`);
  }
);

test("absent model visibility preserves defaults; conflicting providers fail before writing", async () => {
  const root = await fixture();
  await initializePluginUi(root);
  const target = path.join(
    root,
    "composition/generated/installed-model-visibility.ts"
  );
  const before = await readFile(target, "utf-8");
  expect(before).toContain("(defaultEnabledIds) => defaultEnabledIds");
  expect(before).not.toContain("@/plugins/");
  await Promise.all(
    ["first", "second"].map(async (id) => {
      await mkdir(path.join(root, "plugins", id), { recursive: true });
      await writeFile(path.join(root, "plugins", id, "client-plugin.ts"), "");
      await writeFile(
        path.join(root, "plugins", id, "chatjs.json"),
        JSON.stringify({
          contractVersion: 1,
          id,
          kind: "plugin",
          client: { export: "clientPlugin", modelVisibility: true },
        })
      );
    })
  );
  await rejects(
    syncPlugins(root),
    /Only one plugin may supply model visibility/u
  );
  expect(await readFile(target, "utf-8")).toBe(before);
});

test("credits registers native billing and account UI; removing it restores optional defaults", async () => {
  const root = await fixture();
  await initializePluginUi(root);
  await Promise.all(
    (creditsItem.files ?? []).map(async (file) => {
      const target = path.join(root, file.target?.replace(/^~\//u, "") ?? "");
      await mkdir(path.dirname(target), { recursive: true });
      await cp(
        path.resolve(import.meta.dir, "../../../registry", file.path),
        target
      );
    })
  );
  await writeFile(
    path.join(root, "plugins/credits/chatjs.json"),
    JSON.stringify(creditsItem.meta?.chatjs)
  );
  await syncPlugins(root, { expected: ["credits"] });
  const registration = async (name: string): Promise<string> =>
    await readFile(
      path.join(root, `composition/generated/installed-${name}.ts`),
      "utf-8"
    );
  expect(await registration("billing")).toContain("@/plugins/credits/billing");
  expect(await registration("billing")).not.toContain("server-plugin");
  expect(await registration("account-ui")).toContain(
    "plugin0().accountSummary"
  );
  expect(await registration("database")).toContain(
    "plugins/credits/credits-schema"
  );
  expect(await registration("routers")).toContain(
    "credits: plugin0().routers.credits"
  );
  await rm(path.join(root, "plugins/credits"), { recursive: true });
  await syncPlugins(root);
  expect(await registration("billing")).toContain("Promise.resolve(true)");
  expect(await registration("billing")).not.toContain("@/plugins/");
  expect(await registration("account-ui")).not.toContain("@/plugins/");
});

test.each(["usageBilling", "canSpend", "UsageBilling"])(
  "billing export %s compiles without collisions and preserves its receiver",
  async (exportName) => {
    const root = await fixture();
    const directory = path.join(root, "plugins/custom-billing");
    await mkdir(directory, { recursive: true });
    await mkdir(path.join(root, "lib"), { recursive: true });
    await writeFile(
      path.join(root, "lib/usage-billing-contracts.ts"),
      "export interface UsageBilling { canSpend: (ownerId: string) => Promise<boolean> }"
    );
    await writeFile(
      path.join(directory, "billing.ts"),
      `export const ${exportName} = { allowedOwner: "allowed", canSpend(ownerId: string) { return Promise.resolve(ownerId === this.allowedOwner); } };`
    );
    await writeFile(
      path.join(directory, "chatjs.json"),
      JSON.stringify({
        contractVersion: 1,
        kind: "plugin",
        id: "custom-billing",
        files: ["plugins/custom-billing/billing.ts"],
        billing: { export: exportName },
      })
    );
    await syncPlugins(root);
    expect(registrationDiagnostics(root, "billing")).toEqual([]);
    expect(
      await runRegistration(
        root,
        "billing",
        'assert.equal(await registration.canSpend("allowed"), true);\nassert.equal(await registration.canSpend("denied"), false);'
      )
    ).toEqual({ exitCode: 0, stderr: "" });
  }
);

test.each([true, false])(
  "account summary registration validates optional factory contributions (provided=%s)",
  async (provided) => {
    const root = await fixture();
    const directory = path.join(root, "plugins/custom-summary");
    await mkdir(directory, { recursive: true });
    await mkdir(path.join(root, "lib"), { recursive: true });
    await writeFile(
      path.join(root, "lib/react.ts"),
      "export type ComponentType = () => unknown;"
    );
    await writeFile(
      path.join(directory, "client-plugin.ts"),
      `import type { ComponentType } from "react";
interface ChatClientPlugin { readonly accountSummary?: ComponentType }
export const customClient = (): ChatClientPlugin => (${provided ? "{ accountSummary: () => null }" : "{}"});`
    );
    await writeFile(
      path.join(directory, "chatjs.json"),
      JSON.stringify({
        contractVersion: 1,
        kind: "plugin",
        id: "custom-summary",
        files: ["plugins/custom-summary/client-plugin.ts"],
        client: { export: "customClient", accountSummary: true },
      })
    );
    await syncPlugins(root);
    expect(registrationDiagnostics(root, "account-ui")).toEqual([]);
    const result = await runRegistration(
      root,
      "account-ui",
      "assert.equal(registration.installedAccountSummaries[0].Component(), null);"
    );
    if (provided) {
      expect(result.exitCode).toBe(0);
    } else {
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain(
        'Plugin "custom-summary" declares accountSummary but does not provide it.'
      );
    }
  }
);

test("two billing contributors fail before any registration is written", async () => {
  const root = await fixture();
  await initializePluginUi(root);
  const file = path.join(root, "composition/generated/installed-billing.ts");
  const before = await readFile(file, "utf-8");
  await Promise.all(
    ["first", "second"].map(async (id) => {
      const directory = path.join(root, "plugins", id);
      await mkdir(directory, { recursive: true });
      await writeFile(
        path.join(directory, "billing.ts"),
        "export const billing = {};"
      );
      await writeFile(
        path.join(directory, "chatjs.json"),
        JSON.stringify({
          contractVersion: 1,
          kind: "plugin",
          id,
          files: [`plugins/${id}/billing.ts`],
          billing: { export: "billing" },
        })
      );
    })
  );
  await rejects(syncPlugins(root), /Only one plugin may supply usage billing/u);
  expect(await readFile(file, "utf-8")).toBe(before);
});
