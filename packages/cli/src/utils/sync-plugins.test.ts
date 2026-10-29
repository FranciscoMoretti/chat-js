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

import {
  initializePluginUi,
  pluginRegistrationTargets,
  syncPlugins,
} from "./sync-plugins";

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
test("plugin sync generates UI registrations without editing application composition", async () => {
  const root = await fixture();
  await initializePluginUi(root);
  const composer = "export const composerControls = getUserControls();\n";
  const settings = "export const settingsItems = getUserSettings();\n";
  await writeFile(path.join(root, "composer-controls.ts"), composer);
  await writeFile(path.join(root, "settings-items.ts"), settings);
  await install(root);
  await syncPlugins(root, { expected: ["mcp"] });
  expect(
    await readFile(
      path.join(root, "composition/generated/installed-composer-controls.ts"),
      "utf-8"
    )
  ).toContain("@/plugins/mcp/client-plugin");
  expect(
    await readFile(
      path.join(root, "composition/generated/installed-settings-items.ts"),
      "utf-8"
    )
  ).toContain("@/plugins/mcp/client-plugin");
  await syncPlugins(root);
  expect(await readFile(path.join(root, "composer-controls.ts"), "utf-8")).toBe(
    composer
  );
  expect(await readFile(path.join(root, "settings-items.ts"), "utf-8")).toBe(
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
      expected: ["mcp", "attachment-uploads"],
    });
    const composer = await readFile(
      path.join(root, "composition/generated/installed-composer-controls.ts"),
      "utf-8"
    );
    expect(composer).toContain("@/plugins/attachment-uploads/client-plugin");
    expect(composer).toContain("@/plugins/mcp/client-plugin");
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
  await syncPlugins(root, { expected: ["team-notes"] });
  const routers = await readFile(
    path.join(root, "composition/generated/installed-routers.ts"),
    "utf-8"
  );
  expect(routers).toContain('from "@/plugins/team-notes/server-plugin"');
  expect(routers).toContain("notes: plugin0().routers.notes");
  const composer = await readFile(
    path.join(root, "composition/generated/installed-composer-controls.ts"),
    "utf-8"
  );
  expect(composer).toContain("teamNotesClient");
  expect(composer).not.toContain("/server");
  await syncPlugins(root, {});
  expect(
    await readFile(
      path.join(root, "composition/generated/installed-composer-controls.ts"),
      "utf-8"
    )
  ).toBe(composer);
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
    expect(syncPlugins(root, {})).rejects.toThrow(
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
      await rejects(syncPlugins(root, {}), /Duplicate or reserved plugin/u);
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

test("signed-out, session policy and cleanup contributions disappear when absent", async () => {
  const root = await fixture();
  await initializePluginUi(root);
  const names = ["signed-out", "session-profiles", "cleanup"];
  for (const name of names) {
    // oxlint-disable-next-line no-await-in-loop -- Inspect each independently generated boundary.
    const content = await readFile(
      path.join(root, `composition/generated/installed-${name}.ts`),
      "utf-8"
    );
    expect(content).not.toContain("@/plugins/");
  }
});

const runtimeContributions = [
  {
    entry: "signed-out.tsx",
    contribution: { signedOut: { export: "Screen" } },
    conflict: "Only one plugin may supply the signed-out screen.",
  },
  {
    entry: "session-profile.ts",
    contribution: {
      sessionProfile: { export: "profile", authenticator: "same-profile" },
    },
    conflict: "Duplicate or reserved plugin identity: same-profile",
  },
  {
    entry: "cleanup.ts",
    contribution: { cleanup: { export: "cleanup", id: "same-task" } },
    conflict: "Duplicate or reserved plugin identity: same-task",
  },
];

test.each(runtimeContributions)(
  "rejects ambiguous $entry contributions before writing registrations",
  async ({ entry, contribution, conflict }) => {
    const root = await fixture();
    await initializePluginUi(root);
    await Promise.all(
      ["first", "second"].map(async (id) => {
        const directory = path.join(root, "plugins", id);
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, entry), "export {};\n");
        await writeFile(
          path.join(directory, "chatjs.json"),
          JSON.stringify({
            contractVersion: 2,
            uiBase: "base",
            id,
            kind: "plugin",
            ...contribution,
          })
        );
      })
    );
    await rejects(syncPlugins(root), { message: conflict });
    expect(
      await readFile(
        path.join(root, "composition/generated/installed-session-profiles.ts"),
        "utf-8"
      )
    ).not.toContain("@/plugins/");
  }
);

test.each(runtimeContributions)(
  "missing implied $entry fails before changing registrations",
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
    const directory = path.join(root, "plugins/fixture");
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "chatjs.json"),
      JSON.stringify({
        contractVersion: 2,
        uiBase: "base",
        kind: "plugin",
        id: "fixture",
        ...contribution,
      })
    );
    await rejects(syncPlugins(root), {
      message: `fixture installation is incomplete. Missing: plugins/fixture/${entry}. Run chat-js add fixture.`,
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
    contribution: { authentication: { export: "auth" } },
  },
  {
    label: "authentication UI",
    entry: "auth-form.tsx",
    contribution: { authenticationUi: { form: "Form", signOut: "signOut" } },
  },
  {
    label: "modified navigation",
    entry: "navigation.ts",
    contribution: { navigation: { export: "navigation" } },
  },
])(
  "duplicate $label providers leave registrations unchanged",
  async ({ label, entry, contribution }) => {
    const root = await fixture();
    await initializePluginUi(root);
    const file = path.join(root, "composition/generated/installed-auth.ts");
    const before = await readFile(file, "utf-8");
    await Promise.all(
      ["first", "second"].map(async (id) => {
        const directory = path.join(root, "plugins", id);
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, entry), "export {};\n");
        await writeFile(
          path.join(directory, "chatjs.json"),
          JSON.stringify({
            contractVersion: 2,
            uiBase: "base",
            id,
            kind: "plugin",
            files: [`plugins/${id}/${entry}`],
            ...contribution,
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
  await initializePluginUi(root);
  expect(
    await runRegistration(
      root,
      "sign-out",
      "assert.equal(await registration.signOutWithPlugin(), false);"
    )
  ).toEqual({ exitCode: 0, stderr: "" });
  const directory = path.join(root, "plugins", "auth-fixture");
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(directory, "auth-form.tsx"),
      'import "missing-form-dependency"; export const Form = () => null;'
    ),
    writeFile(
      path.join(directory, "client-plugin.ts"),
      'import "missing-layout-dependency"; export const client = () => ({});'
    ),
    writeFile(
      path.join(directory, "sign-out.ts"),
      "export const signOut = () => Promise.resolve(true);"
    ),
    writeFile(
      path.join(directory, "chatjs.json"),
      JSON.stringify({
        contractVersion: 2,
        uiBase: "base",
        id: "auth-fixture",
        kind: "plugin",
        files: [
          "plugins/auth-fixture/auth-form.tsx",
          "plugins/auth-fixture/sign-out.ts",
          "plugins/auth-fixture/client-plugin.ts",
        ],
        client: { export: "client", layout: true },
        authenticationUi: { form: "Form", signOut: "signOut" },
      })
    ),
  ]);
  await syncPlugins(root);
  expect(
    await runRegistration(
      root,
      "sign-out",
      "assert.equal(await registration.signOutWithPlugin(), true);"
    )
  ).toEqual({ exitCode: 0, stderr: "" });
});
