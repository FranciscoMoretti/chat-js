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
import { createRequire } from "node:module";
import { tmpdir } from "node:os";

import ts from "typescript";

import { scaffoldFromTemplate } from "#cli/helpers/scaffold";

import { installItems } from "#cli/registry/shadcn";

import { mcpFiles, mcpItem } from "../../../registry/src/plugins/mcp/manifest";

import { installPlan } from "./install-plan";
import { planInstallation } from "./installation-plan";

import {
  initializePluginUi,
  pluginRegistrationTargets,
  syncPlugins,
} from "./sync-plugins";

const roots: string[] = [];
const demo = path.resolve(import.meta.dir, "../../../../apps/chat");
const reactTypes = path.dirname(
  createRequire(path.join(demo, "package.json")).resolve(
    "@types/react/package.json"
  )
);
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
    ["composer-controls.ts", "components.json"].map(
      async (file): Promise<void> => {
        await cp(path.join(demo, file), path.join(root, file));
      }
    )
  );
  return root;
};
const registrationDiagnostics = (root: string, name: string): string[] => {
  const program = ts.createProgram({
    rootNames: [path.join(root, `chatjs/generated/installed-${name}.ts`)],
    options: {
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      paths: {
        "@/*": [`${root}/*`],
        react: [reactTypes],
        "react/jsx-runtime": [path.join(reactTypes, "jsx-runtime.d.ts")],
      },
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
  assertions: string,
  integration = false
): Promise<{ exitCode: number; stderr: string }> => {
  const tsconfig = path.join(root, "tsconfig.json");
  await writeFile(
    tsconfig,
    JSON.stringify({ compilerOptions: { paths: { "@/*": [`${root}/*`] } } })
  );
  const build = await Bun.build({
    entrypoints: [
      path.join(
        root,
        integration
          ? `integrations/${name}.ts`
          : `chatjs/generated/installed-${name}.ts`
      ),
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
    path.join(root, "chatjs/plugins/mcp/plugin.json"),
    JSON.stringify(mcpItem.meta?.chatjs)
  );
};
test("plugin sync generates UI registrations without editing application composition", async () => {
  const root = await fixture();
  await initializePluginUi(root);
  const composer = "export const composerControls = getUserControls();\n";
  const settings =
    "export const SettingsLayout = () => <nav>Application settings</nav>;\n";
  await writeFile(path.join(root, "composer-controls.ts"), composer);
  await writeFile(path.join(root, "settings-layout.tsx"), settings);
  await install(root);
  await syncPlugins(root, { expected: ["mcp"] });
  expect(
    await readFile(
      path.join(root, "chatjs/generated/installed-chat-ui.ts"),
      "utf-8"
    )
  ).toContain("@/chatjs/plugins/mcp/chat-ui");
  expect(
    await readFile(
      path.join(root, "chatjs/generated/installed-chat-ui.ts"),
      "utf-8"
    )
  ).toContain("@/chatjs/plugins/mcp/chat-ui");
  await syncPlugins(root);
  expect(await readFile(path.join(root, "composer-controls.ts"), "utf-8")).toBe(
    composer
  );
  expect(await readFile(path.join(root, "settings-layout.tsx"), "utf-8")).toBe(
    settings
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
      path.join(root, "chatjs/generated/installed-routers.ts"),
      "utf-8"
    )
  ).not.toContain("@/chatjs/plugins/mcp/router");
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
    target: "~/chatjs/plugins/mcp/plugin.json",
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
      await syncPlugins(root, { expected: ["mcp"] });
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
        path.join(root, "chatjs/generated/installed-database.ts"),
        "utf-8"
      )
    ).toContain("chatjs/plugins/mcp/db/mcp-schema.ts");
    expect(
      await readFile(
        path.join(root, "chatjs/generated/installed-routers.ts"),
        "utf-8"
      )
    ).toContain(
      'import { router as mcpRouter } from "@/chatjs/plugins/mcp/router"'
    );
  } finally {
    await server.stop(true);
  }
}, 30_000);

test("missing descriptors report partial MCP source and how to recover", async (): Promise<void> => {
  const root = await fixture();
  await initializePluginUi(root);
  await install(root);
  await rm(path.join(root, "chatjs/plugins/mcp/plugin.json"));
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
    await readFile(path.join(root, "chatjs/generated/installed.ts"), "utf-8")
  ).toContain("new Set()");
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
      path.join(root, "chatjs/generated/installed-uploads.ts"),
      "utf-8"
    )
  ).not.toContain("@/chatjs/plugins/attachment-uploads");
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
    target: "~/chatjs/plugins/attachment-uploads/plugin.json",
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
      expected: ["mcp", "attachment-uploads"],
    });
    const composer = await readFile(
      path.join(root, "chatjs/generated/installed-chat-ui.ts"),
      "utf-8"
    );
    expect(composer).toContain("@/chatjs/plugins/attachment-uploads/chat-ui");
    expect(composer).toContain("@/chatjs/plugins/mcp/chat-ui");
    expect(
      await readFile(path.join(root, "chatjs/generated/installed.ts"), "utf-8")
    ).toContain('"attachment-uploads"');
    expect(
      await readFile(
        path.join(root, "chatjs/generated/installed-uploads.ts"),
        "utf-8"
      )
    ).toContain("@/chatjs/plugins/attachment-uploads/uploads");
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

test("third-party plugins contribute without CLI changes or executing their server entrypoint", async () => {
  const root = await fixture();
  await initializePluginUi(root);
  const directory = path.join(root, "chatjs/plugins/team-notes");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "plugin.json"),
    JSON.stringify({
      contractVersion: 3,
      id: "team-notes",
      kind: "plugin",
      files: [
        "chatjs/plugins/team-notes/router.ts",
        "chatjs/plugins/team-notes/chat-ui.ts",
      ],
    })
  );
  // Sync inspects metadata only. Loading the server to discover contributions
  // would require deployment credentials and could execute arbitrary side effects.
  await writeFile(
    path.join(directory, "router.ts"),
    'throw new Error("Do not evaluate server code during sync");'
  );
  await writeFile(
    path.join(directory, "chat-ui.ts"),
    'import { definePlugin } from "@/chatjs/core/ui/slots"; export const chatUi = definePlugin({ id: "team-notes", slots: [] });'
  );
  await syncPlugins(root, { expected: ["team-notes"] });
  const routers = await readFile(
    path.join(root, "chatjs/generated/installed-routers.ts"),
    "utf-8"
  );
  expect(routers).toContain(
    'import { router as teamNotesRouter } from "@/chatjs/plugins/team-notes/router"'
  );
  expect(routers).toContain("[teamNotesRouter] as const");
  const composer = await readFile(
    path.join(root, "chatjs/generated/installed-chat-ui.ts"),
    "utf-8"
  );
  await mkdir(path.join(root, "lib"), { recursive: true });
  await cp(
    path.join(demo, "chatjs/core/ui/slots.tsx"),
    path.join(root, "chatjs/core/ui/slots.tsx")
  );
  expect(registrationDiagnostics(root, "chat-ui")).toEqual([]);
  expect(composer).toContain("teamNotesClient");
  expect(composer).not.toContain("/server");
  await syncPlugins(root, {});
  expect(
    await readFile(
      path.join(root, "chatjs/generated/installed-chat-ui.ts"),
      "utf-8"
    )
  ).toBe(composer);
});

const serverFixture = async (): Promise<string> => {
  const root = await fixture();
  const core = "chatjs/core/installation";
  await mkdir(path.join(root, core), { recursive: true });
  await writeFile(
    path.join(root, core, "contracts.ts"),
    "export type InstrumentationRegistration = () => void | Promise<void>;"
  );
  return root;
};

const writeServerPlugin = async (
  root: string,
  id: string,
  source: string
): Promise<void> => {
  const directory = `chatjs/plugins/${id}`;
  await mkdir(path.join(root, directory), { recursive: true });
  await writeFile(path.join(root, directory, "router.ts"), source);
  await writeFile(
    path.join(root, directory, "plugin.json"),
    JSON.stringify({
      contractVersion: 3,
      kind: "plugin",
      id,
      files: [`${directory}/router.ts`],
    })
  );
};

test("server wiring composes typed router maps and supports instrumentation-only plugins", async () => {
  const root = await serverFixture();
  await writeServerPlugin(
    root,
    "team-notes",
    `Object.assign(globalThis, { notesLoaded: true });
export const router = { notes: { list: () => ["first"] }, archive: {} };`
  );
  const directory = "chatjs/plugins/startup";
  await mkdir(path.join(root, directory), { recursive: true });
  await writeFile(
    path.join(root, directory, "instrumentation.ts"),
    `export default () => { Object.assign(globalThis, { startupRan: true }); };`
  );
  await writeFile(
    path.join(root, directory, "plugin.json"),
    JSON.stringify({
      contractVersion: 3,
      kind: "plugin",
      id: "startup",
      files: [`${directory}/instrumentation.ts`],
    })
  );
  await syncPlugins(root);
  const config = path.join(root, "chatjs/generated/installed-routers.ts");
  await writeFile(
    config,
    `${await readFile(config, "utf-8")}\ninstalledRouters[0].notes.list();\n`
  );
  expect(registrationDiagnostics(root, "routers")).toEqual([]);
  expect(
    await runRegistration(
      root,
      "routers",
      'assert.deepEqual(Object.keys(registration.installedRouters[0]), ["notes", "archive"]);'
    )
  ).toEqual({ exitCode: 0, stderr: "" });
  expect(
    await runRegistration(
      root,
      "instrumentation",
      "await Promise.all(registration.installedInstrumentation.map((register) => register()));\nassert.equal(globalThis.startupRan, true);\nassert.equal(Object.hasOwn(globalThis, 'notesLoaded'), false);"
    )
  ).toEqual({ exitCode: 0, stderr: "" });
});

test("obsolete plugin descriptors fail before sync rewrites registrations", async () => {
  const root = await fixture();
  await initializePluginUi(root);
  const target = path.join(root, "chatjs/generated/installed-routers.ts");
  const before = await readFile(target, "utf-8");
  const directory = path.join(root, "chatjs/plugins/old");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "plugin.json"),
    JSON.stringify({
      id: "old",
      kind: "plugin",
      contractVersion: 2,
      uiBase: "base",
      server: { routers: ["old"] },
    })
  );
  await rejects(syncPlugins(root), /Use plugin contractVersion 3/u);
  expect(await readFile(target, "utf-8")).toBe(before);
});

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
  async ({ item, schema }) => {
    const root = await fixture();
    await initializePluginUi(root);
    const uninstalled = await Promise.all(
      ["installed-chat", "installed-chat-ui", "installed-database"].map(
        async (name) =>
          await readFile(
            path.join(root, `chatjs/generated/${name}.ts`),
            "utf-8"
          )
      )
    );
    for (const source of uninstalled) {
      expect(source).not.toContain("chatjs/plugins/");
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
      path.join(root, `chatjs/plugins/${item.name}/plugin.json`),
      JSON.stringify(item.meta?.chatjs)
    );
    await syncPlugins(root, { expected: [item.name] });
    const lifecycle = await readFile(
      path.join(root, "chatjs/generated/installed-chat.ts"),
      "utf-8"
    );
    if (item.name === "model-preferences") {
      expect(lifecycle).not.toContain("@/chatjs/plugins/");
      const visibility = await readFile(
        path.join(root, "chatjs/generated/installed-model-visibility.ts"),
        "utf-8"
      );
      expect(visibility).toContain("import { useModelVisibility }");
      expect(visibility).toContain(
        "@/chatjs/plugins/model-preferences/model-visibility"
      );
    } else {
      expect(lifecycle).toContain(`@/chatjs/plugins/${item.name}/chat-server`);
    }
    expect(lifecycle).not.toContain("router");
    expect(lifecycle).not.toContain("routers");
    expect(
      await readFile(
        path.join(root, "chatjs/generated/installed-routers.ts"),
        "utf-8"
      )
    ).toContain(`from "@/chatjs/plugins/${item.name}/router"`);
    expect(
      await readFile(
        path.join(root, "chatjs/generated/installed-database.ts"),
        "utf-8"
      )
    ).toContain(`chatjs/plugins/${item.name}/${schema}`);
  }
);

test("absent model visibility preserves defaults; conflicting providers fail before writing", async () => {
  const root = await fixture();
  await initializePluginUi(root);
  const target = path.join(
    root,
    "chatjs/generated/installed-model-visibility.ts"
  );
  const before = await readFile(target, "utf-8");
  expect(before).toContain(
    "installedModelVisibility: readonly ModelVisibility[] = []"
  );
  expect(before).not.toContain("@/chatjs/plugins/");
  await Promise.all(
    ["first", "second"].map(async (id) => {
      await mkdir(path.join(root, "chatjs/plugins", id), { recursive: true });
      await writeFile(
        path.join(root, "chatjs/plugins", id, "model-visibility.ts"),
        ""
      );
      await writeFile(
        path.join(root, "chatjs/plugins", id, "plugin.json"),
        JSON.stringify({
          contractVersion: 3,
          id,
          kind: "plugin",
          files: [`chatjs/plugins/${id}/model-visibility.ts`],
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
    path.join(root, "chatjs/plugins/credits/plugin.json"),
    JSON.stringify(creditsItem.meta?.chatjs)
  );
  await syncPlugins(root, { expected: ["credits"] });
  const registration = async (name: string): Promise<string> =>
    await readFile(
      path.join(root, `chatjs/generated/installed-${name}.ts`),
      "utf-8"
    );
  expect(await registration("billing")).toContain(
    "@/chatjs/plugins/credits/billing"
  );
  expect(await registration("billing")).not.toContain("router");
  expect(await registration("chat-ui")).toContain(
    "@/chatjs/plugins/credits/chat-ui"
  );
  expect(await registration("database")).toContain(
    "chatjs/plugins/credits/credits-schema"
  );
  expect(await registration("routers")).toContain(
    'import { router as creditsRouter } from "@/chatjs/plugins/credits/router"'
  );
  await rm(path.join(root, "chatjs/plugins/credits"), { recursive: true });
  await syncPlugins(root);
  expect(await registration("billing")).toContain(
    "installedBilling: readonly UsageBilling[] = []"
  );
  expect(await registration("billing")).not.toContain("@/chatjs/plugins/");
  expect(await registration("chat-ui")).not.toContain("@/chatjs/plugins/");
});

test.each(["usageBilling", "canSpend", "UsageBilling"])(
  "billing export %s compiles without collisions and preserves its receiver",
  async (exportName) => {
    const root = await fixture();
    const directory = path.join(root, "chatjs/plugins/custom-billing");
    await mkdir(directory, { recursive: true });
    await mkdir(path.join(root, "chatjs/core/billing"), { recursive: true });
    await writeFile(
      path.join(root, "chatjs/core/billing/contracts.ts"),
      "export interface UsageBilling { canSpend: (ownerId: string) => Promise<boolean> }"
    );
    await writeFile(
      path.join(directory, "billing.ts"),
      `const ${exportName} = { allowedOwner: "allowed", canSpend(ownerId: string) { return Promise.resolve(ownerId === this.allowedOwner); } }; export default ${exportName};`
    );
    await writeFile(
      path.join(directory, "plugin.json"),
      JSON.stringify({
        contractVersion: 3,
        kind: "plugin",
        id: "custom-billing",
        files: ["chatjs/plugins/custom-billing/billing.ts"],
      })
    );
    await syncPlugins(root);
    expect(registrationDiagnostics(root, "billing")).toEqual([]);
    expect(
      await runRegistration(
        root,
        "billing",
        'assert.equal(await registration.installedBilling[0].canSpend("allowed"), true);\nassert.equal(await registration.installedBilling[0].canSpend("denied"), false);'
      )
    ).toEqual({ exitCode: 0, stderr: "" });
  }
);

test("UI registration preserves module-scope plugin declarations without invoking factories", async () => {
  const root = await fixture();
  await initializePluginUi(root);
  await install(root);
  await syncPlugins(root);
  const source = await readFile(
    path.join(root, "chatjs/generated/installed-chat-ui.ts"),
    "utf-8"
  );
  expect(source).toContain("[mcpClient]");
  expect(source).not.toContain("mcpClient()");
  expect(source).not.toContain("router");
});

test("two billing contributors fail before any registration is written", async () => {
  const root = await fixture();
  await initializePluginUi(root);
  const file = path.join(root, "chatjs/generated/installed-billing.ts");
  const before = await readFile(file, "utf-8");
  await Promise.all(
    ["first", "second"].map(async (id) => {
      const directory = path.join(root, "chatjs/plugins", id);
      await mkdir(directory, { recursive: true });
      await writeFile(
        path.join(directory, "billing.ts"),
        "export const billing = {};"
      );
      await writeFile(
        path.join(directory, "plugin.json"),
        JSON.stringify({
          contractVersion: 3,
          kind: "plugin",
          id,
          files: [`chatjs/plugins/${id}/billing.ts`],
        })
      );
    })
  );
  await rejects(syncPlugins(root), /Only one plugin may supply usage billing/u);
  expect(await readFile(file, "utf-8")).toBe(before);
});

test("signed-out, session policy and cleanup contributions disappear when absent", async () => {
  const root = await fixture();
  await initializePluginUi(root);
  const names = ["signed-out", "session-profiles", "cleanup"];
  for (const name of names) {
    // oxlint-disable-next-line no-await-in-loop -- Inspect each independently generated boundary.
    const content = await readFile(
      path.join(root, `chatjs/generated/installed-${name}.ts`),
      "utf-8"
    );
    expect(content).not.toContain("@/chatjs/plugins/");
  }
});

test("cleanup reports use the IDs of the plugins that own the runners", async () => {
  const root = await fixture();
  await initializePluginUi(root);
  await Promise.all(
    ["alpha", "beta"].map(async (id, index) => {
      const directory = path.join(root, "chatjs/plugins", id);
      await mkdir(directory, { recursive: true });
      await writeFile(
        path.join(directory, "cleanup.ts"),
        `export default async () => ({ deletedCount: ${index}, skipped: false });`
      );
      await writeFile(
        path.join(directory, "plugin.json"),
        JSON.stringify({
          id,
          kind: "plugin",
          contractVersion: 3,
          files: [`chatjs/plugins/${id}/cleanup.ts`],
        })
      );
    })
  );
  await syncPlugins(root);
  const result = await runRegistration(
    root,
    "cleanup",
    `
    const reports = await Promise.all(registration.installedCleanupTasks.map(async ({ id, run }) => [id, await run()]));
    assert.deepEqual(reports, [["alpha", { deletedCount: 0, skipped: false }], ["beta", { deletedCount: 1, skipped: false }]]);
  `
  );
  expect(result).toEqual({ exitCode: 0, stderr: "" });
});

const runtimeContributions = [
  {
    entry: "signed-out.tsx",
    contribution: {},
    conflict: "Only one plugin may supply the signed-out screen.",
  },
  {
    entry: "session-profile.ts",
    contribution: {
      sessionAuthenticator: "same-profile",
    },
    conflict: "Duplicate or reserved plugin identity: same-profile",
  },
];

test.each(runtimeContributions)(
  "rejects ambiguous $entry contributions before writing registrations",
  async ({ entry, contribution, conflict }) => {
    const root = await fixture();
    await initializePluginUi(root);
    await Promise.all(
      ["first", "second"].map(async (id) => {
        const directory = path.join(root, "chatjs/plugins", id);
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, entry), "export {};\n");
        await writeFile(
          path.join(directory, "plugin.json"),
          JSON.stringify({
            contractVersion: 3,
            uiBase: "base",
            id,
            kind: "plugin",
            files: [`chatjs/plugins/${id}/${entry}`],
            ...contribution,
          })
        );
      })
    );
    await rejects(syncPlugins(root), { message: conflict });
    expect(
      await readFile(
        path.join(root, "chatjs/generated/installed-session-profiles.ts"),
        "utf-8"
      )
    ).not.toContain("@/chatjs/plugins/");
  }
);

test.each([...runtimeContributions, { entry: "cleanup.ts", contribution: {} }])(
  "missing declared $entry fails before changing registrations",
  async ({ entry, contribution }) => {
    const root = await fixture();
    await initializePluginUi(root);
    const readRegistrations = async () =>
      await Promise.all(
        pluginRegistrationTargets.map(
          async (file) => await readFile(path.join(root, file), "utf-8")
        )
      );
    const before = await readRegistrations();
    const directory = path.join(root, "chatjs/plugins/fixture");
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "plugin.json"),
      JSON.stringify({
        contractVersion: 3,
        uiBase: "base",
        kind: "plugin",
        id: "fixture",
        files: [`chatjs/plugins/fixture/${entry}`],
        ...contribution,
      })
    );
    await rejects(syncPlugins(root), {
      message: `fixture installation is incomplete. Missing: chatjs/plugins/fixture/${entry}. Run chat-js add fixture.`,
    });
    expect(await readRegistrations()).toEqual(before);
    await writeFile(path.join(directory, entry), "export {};\n");
    await syncPlugins(root);
    expect(await readRegistrations()).not.toEqual(before);
  }
);

test.each([
  {
    label: "authentication",
    entry: "auth-server.ts",
  },
  {
    label: "authentication UI",
    entry: "auth-form.tsx",
  },
  {
    label: "modified navigation",
    entry: "navigation.ts",
  },
])(
  "duplicate $label providers leave registrations unchanged",
  async ({ label, entry }) => {
    const root = await fixture();
    await initializePluginUi(root);
    const file = path.join(root, "chatjs/generated/installed-auth.ts");
    const before = await readFile(file, "utf-8");
    await Promise.all(
      ["first", "second"].map(async (id) => {
        const directory = path.join(root, "chatjs/plugins", id);
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, entry), "export {};\n");
        await writeFile(
          path.join(directory, "plugin.json"),
          JSON.stringify({
            contractVersion: 3,
            uiBase: "base",
            id,
            kind: "plugin",
            files: [`chatjs/plugins/${id}/${entry}`],
          })
        );
      })
    );
    await rejects(syncPlugins(root), {
      message: `Only one plugin may supply ${label}.`,
    });
    expect(await readFile(file, "utf-8")).toBe(before);
  }
);

test("sign-out defaults to web and stays independent of auth forms and layout", async () => {
  const root = await fixture();
  await mkdir(path.join(root, "integrations/auth"), { recursive: true });
  await mkdir(path.join(root, "lib"));
  await cp(
    path.join(demo, "integrations/auth/sign-out.ts"),
    path.join(root, "integrations/auth/sign-out.ts")
  );
  await cp(
    path.join(demo, "chatjs/core/installation/select.ts"),
    path.join(root, "chatjs/core/installation/select.ts")
  );
  await initializePluginUi(root);
  expect(
    await runRegistration(
      root,
      "auth/sign-out",
      "assert.equal(await registration.signOutWithPlugin(), false);",
      true
    )
  ).toEqual({ exitCode: 0, stderr: "" });
  const directory = path.join(root, "chatjs/plugins", "auth-fixture");
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(directory, "auth-form.tsx"),
      'import "missing-form-dependency"; export default () => null;'
    ),
    writeFile(
      path.join(directory, "layout-ui.ts"),
      'import "missing-layout-dependency"; export const layoutUi = { id: "auth-fixture", slots: [] };'
    ),
    writeFile(
      path.join(directory, "sign-out.ts"),
      "export default () => Promise.resolve(true);"
    ),
    writeFile(
      path.join(directory, "plugin.json"),
      JSON.stringify({
        contractVersion: 3,
        uiBase: "base",
        id: "auth-fixture",
        kind: "plugin",
        files: [
          "chatjs/plugins/auth-fixture/auth-form.tsx",
          "chatjs/plugins/auth-fixture/sign-out.ts",
          "chatjs/plugins/auth-fixture/layout-ui.ts",
        ],
      })
    ),
  ]);
  await syncPlugins(root);
  expect(
    await runRegistration(
      root,
      "auth/sign-out",
      "assert.equal(await registration.signOutWithPlugin(), true);",
      true
    )
  ).toEqual({ exitCode: 0, stderr: "" });
});

test("a plugin with layout and chat UI participates in both scopes", async () => {
  const root = await fixture();
  await mkdir(path.join(root, "chatjs/plugins/mixed"), { recursive: true });
  await writeFile(
    path.join(root, "chatjs/plugins/mixed/chat-ui.ts"),
    "export const chatUi = { id: 'mixed', slots: [] }; "
  );
  await writeFile(
    path.join(root, "chatjs/plugins/mixed/layout-ui.ts"),
    "export const layoutUi = { id: 'mixed', slots: [] };"
  );
  await writeFile(
    path.join(root, "chatjs/plugins/mixed/plugin.json"),
    JSON.stringify({
      contractVersion: 3,
      uiBase: "base",
      id: "mixed",
      kind: "plugin",
      files: [
        "chatjs/plugins/mixed/chat-ui.ts",
        "chatjs/plugins/mixed/layout-ui.ts",
      ],
    })
  );
  await syncPlugins(root);
  const sources = await Promise.all(
    ["chat-ui", "layout"].map(
      async (scope) =>
        await readFile(
          path.join(root, `chatjs/generated/installed-${scope}.ts`),
          "utf-8"
        )
    )
  );
  expect(sources[0]).toContain("@/chatjs/plugins/mixed/chat-ui");
  expect(sources[1]).toContain("@/chatjs/plugins/mixed/layout-ui");
});
