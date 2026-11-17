import assert from "node:assert/strict";
import { requireJsonObject } from "#cli/helpers/json-object";
import { toolDefinitionSchema } from "../../../registry/metadata";
import { afterEach, expect, spyOn, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";

import path from "node:path";
import { tmpdir } from "node:os";

import { syncTools } from "./sync-tools";
import * as installationFiles from "./installation-files";

const generatedRegistryRules: readonly string[] = [
  "import/no-duplicates",
  "typescript/consistent-type-definitions",
];

const lintGeneratedRegistryComposition = async (
  root: string
): Promise<void> => {
  const config = path.join(root, "registry-lint.json");
  await writeFile(config, JSON.stringify({ rules: {} }));
  const result = Bun.spawn({
    cmd: [
      path.join(import.meta.dir, "../../../../node_modules/.bin/oxlint"),
      "-c",
      config,
      "--import-plugin",
      "-A",
      "all",
      ...generatedRegistryRules.flatMap((rule): string[] => ["-D", rule]),
      "--no-ignore",
      "--report-unused-disable-directives-severity",
      "error",
      path.join(root, "chatjs/generated/tools.ts"),
      path.join(root, "chatjs/generated/ui.ts"),
      path.join(root, "chatjs/generated/workflow-types.ts"),
    ],
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    result.exited,
    new Response(result.stdout).text(),
    new Response(result.stderr).text(),
  ]);
  expect(
    exitCode,
    `Native registry validation failed:\n${stdout}\n${stderr}`
  ).toBe(0);
};

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => {
      await rm(root, { force: true, recursive: true });
    })
  );
});
const project = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-sync-"));
  roots.push(root);
  await mkdir(path.join(root, "lib/eve"), { recursive: true });
  await mkdir(path.join(root, "integrations/tools"), { recursive: true });
  await mkdir(path.join(root, "integrations/documents"), { recursive: true });
  await symlink(
    path.resolve(
      import.meta.dir,
      "../../../../apps/chat/lib/eve/tool-types.ts"
    ),
    path.join(root, "lib/eve/tool-types.ts")
  );
  await writeFile(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } })
  );
  await syncTools(root);
  return root;
};
const install = async (
  root: string,
  id = "text-stats",
  toolExport = "textStats"
): Promise<void> => {
  const dir = path.join(root, "chatjs/tools", id);
  await mkdir(dir, { recursive: true });
  const definition = {
    contractVersion: 1,
    envRequirements: [],
    id,
    kind: "tool",
    tools: [{ rendererExport: "TextStatsRenderer", toolExport }],
  };
  await writeFile(path.join(dir, "chatjs.json"), JSON.stringify(definition));
  await writeFile(
    path.join(dir, "tool.ts"),
    `export const ${toolExport} = {};`
  );
  await writeFile(
    path.join(dir, "renderer.tsx"),
    "export const TextStatsRenderer = () => null;"
  );
};
test("definition reads are bounded and registration waits for every admitted directory", async () => {
  const root = await project();
  const ids = ["tool-a", "tool-b", "tool-c", "tool-d", "tool-e"];
  await Promise.all(
    ids.map(async (id, index) => {
      await install(root, id, `tool${index}`);
    })
  );
  const target = path.join(root, "chatjs/generated/tools.ts");
  const before = await readFile(target, "utf-8");
  const gates = ids.map(() => Promise.withResolvers<boolean>());
  const firstBatch = Promise.withResolvers<boolean>();
  const finalBatch = Promise.withResolvers<boolean>();
  const originalRead = installationFiles.optionalFile;
  let reads = 0;
  const read = spyOn(installationFiles, "optionalFile").mockImplementation(
    async (file) => {
      const index =
        path.basename(file) === "chatjs.json"
          ? ids.indexOf(path.basename(path.dirname(file)))
          : -1;
      if (index !== -1) {
        const gate = gates[reads];
        reads += 1;
        if (reads === 4) {
          firstBatch.resolve(true);
        }
        if (reads === 5) {
          finalBatch.resolve(true);
        }
        await gate.promise;
      }
      return await originalRead(file);
    }
  );
  const syncing = syncTools(root);
  try {
    await Promise.race([firstBatch.promise, syncing]);
    expect(reads).toBe(4);
    for (const gate of gates.slice(0, 3)) {
      gate.resolve(true);
    }
    await Promise.resolve();
    expect(reads).toBe(4);
    expect(await readFile(target, "utf-8")).toBe(before);
    gates[3].resolve(true);
    await finalBatch.promise;
    expect(await readFile(target, "utf-8")).toBe(before);
    gates[4].resolve(true);
    await syncing;
    const generatedTools = await readFile(target, "utf-8");
    expect(ids.map((id) => generatedTools.indexOf(`./${id}/tool`))).toEqual(
      ids
        .map((id) => generatedTools.indexOf(`./${id}/tool`))
        .toSorted((left, right) => left - right)
    );
  } finally {
    for (const gate of gates) {
      gate.resolve(true);
    }
    await syncing;
    read.mockRestore();
  }
});

test("generated tool and renderer composition passes native rules without unused exceptions", async (): Promise<void> => {
  const root = await project();
  await lintGeneratedRegistryComposition(root);
  await install(root);
  await syncTools(root);
  await lintGeneratedRegistryComposition(root);
});

test("sync registers direct installs deterministically and preserves custom modules", async () => {
  const root = await project();
  const emptyTools = await readFile(
    path.join(root, "chatjs/generated/tools.ts"),
    "utf-8"
  );
  expect(emptyTools).not.toContain("import { providers }");
  expect(emptyTools).toContain(
    "export const installedTools = defineToolSet({});"
  );
  expect(
    await readFile(path.join(root, "chatjs/generated/providers.ts"), "utf-8")
  ).toContain("export const providers = defineToolSet({});");
  expect(
    await readFile(path.join(root, "chatjs/generated/ui.ts"), "utf-8")
  ).toContain(
    "export const installedToolUi = {} satisfies ToolRendererRegistry;"
  );
  await install(root);
  const custom = path.join(root, "integrations/tools/execution.ts");
  await writeFile(custom, "export const tools = { custom: {} };\n");
  await syncTools(root);
  const before = await readFile(
    path.join(root, "chatjs/generated/tools.ts"),
    "utf-8"
  );
  expect(before).toContain('from "@/chatjs/tools/text-stats/tool"');
  expect(before).not.toContain("import { providers }");
  expect(before).not.toContain("Object.hasOwn");
  const installedBefore = await readFile(
    path.join(root, "chatjs/generated/installed-tools.ts"),
    "utf-8"
  );
  const [header, contentHash, ...body] = installedBefore.split("\n");
  expect(header).toContain("Generated by chat-js sync");
  expect(contentHash).toBe(
    `// Content: ${new Bun.CryptoHasher("sha256").update(body.join("\n")).digest("hex")}`
  );
  expect(installedBefore).toContain("installedToolNames");
  expect(installedBefore).not.toContain("import/group-exports");
  await syncTools(root);
  expect(
    await readFile(path.join(root, "chatjs/generated/tools.ts"), "utf-8")
  ).toBe(before);
  expect(
    await readFile(
      path.join(root, "chatjs/generated/installed-tools.ts"),
      "utf-8"
    )
  ).toBe(installedBefore);
  expect(await readFile(custom, "utf-8")).toContain("custom: {}");
});
test("generated registries sort by registration key instead of directory name", async () => {
  const root = await project();
  await install(root, "a-tool", "zebra");
  await install(root, "z-tool", "alpha");
  await syncTools(root);
  const toolModule = requireJsonObject(
    await import(path.join(root, "chatjs/generated/tools.ts")),
    "tool module"
  );
  const tools = requireJsonObject(toolModule.installedTools, "tool exports");
  const uiModule = requireJsonObject(
    await import(path.join(root, "chatjs/generated/ui.ts")),
    "UI module"
  );
  const ui = requireJsonObject(uiModule.installedToolUi, "UI exports");
  expect(Object.keys(tools)).toEqual(["alpha", "zebra"]);
  expect(Object.keys(ui)).toEqual(["tool-alpha", "tool-zebra"]);
  const { alpha } = requireJsonObject(
    await import(path.join(root, "chatjs/tools/z-tool/tool.ts")),
    "alpha module"
  );
  const { zebra } = requireJsonObject(
    await import(path.join(root, "chatjs/tools/a-tool/tool.ts")),
    "zebra module"
  );
  expect(tools.alpha).toBe(alpha);
  expect(tools.zebra).toBe(zebra);
  await syncTools(root);
});
test("missing descriptors and edited generated output fail without dropping registrations", async () => {
  const root = await project();
  await install(root);
  await syncTools(root);
  const index = path.join(root, "chatjs/generated/tools.ts");
  const before = await readFile(index, "utf-8");
  await rm(path.join(root, "chatjs/tools/text-stats/chatjs.json"));
  expect(syncTools(root)).rejects.toThrow("Missing descriptor");
  expect(await readFile(index, "utf-8")).toBe(before);
  await writeFile(index, `${before}\n// custom edit`);
  expect(syncTools(root)).rejects.toThrow("custom or legacy");
});
test("duplicate keys and symlink directories fail before writing indexes", async () => {
  const root = await project();
  await install(root);
  await install(root, "other");
  expect(syncTools(root)).rejects.toThrow("Duplicate installed");
  await rm(path.join(root, "chatjs/tools/other"), { recursive: true });
  await symlink(
    path.join(root, "chatjs/tools/text-stats"),
    path.join(root, "chatjs/tools/other")
  );
  expect(syncTools(root)).rejects.toThrow("symlinks");
});
test("a requested tool cannot report successful registration without its descriptor", async () => {
  const root = await project();
  expect(
    syncTools(root, {
      expected: [
        {
          contractVersion: 1,
          envRequirements: [],
          id: "missing",
          kind: "tool",
          requiresTools: [],
          tools: [{ rendererExport: "Missing", toolExport: "missing" }],
        },
      ],
    })
  ).rejects.toThrow("does not match requested");
});
const installImageProvider = async (
  root: string,
  id: string,
  key: string
): Promise<void> => {
  const dir = path.join(root, "chatjs/tools", id);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "tool.ts"),
    "export const generateImage = {};"
  );
  await writeFile(
    path.join(dir, "chatjs.json"),
    JSON.stringify({
      contractVersion: 1,
      envRequirements: [{ options: [[key]] }],
      id,
      kind: "tool",
      slot: "generateImage",
      tools: [{ toolExport: "generateImage" }],
    })
  );
};
test("image providers register standard tools without requiring a renderer", async () => {
  const root = await project();
  await installImageProvider(root, "external-image", "EXTERNAL_IMAGE_KEY");
  const definitions = await syncTools(root);
  expect(definitions[0]?.envRequirements).toEqual([
    { options: [["EXTERNAL_IMAGE_KEY"]] },
  ]);
  expect(
    await readFile(path.join(root, "chatjs/generated/providers.ts"), "utf-8")
  ).toContain("@/chatjs/tools/external-image/tool");
  expect(
    await readFile(path.join(root, "chatjs/generated/tools.ts"), "utf-8")
  ).not.toContain("generateImage");
  expect(
    await readFile(path.join(root, "chatjs/generated/ui.ts"), "utf-8")
  ).not.toContain("external-image");
  await installImageProvider(root, "another-image", "ANOTHER_KEY");
  expect(syncTools(root)).rejects.toThrow("Only one generateImage");
  await rm(path.join(root, "chatjs/tools/external-image"), {
    recursive: true,
  });
  await syncTools(root);
  expect(
    await readFile(path.join(root, "chatjs/generated/providers.ts"), "utf-8")
  ).not.toContain("external-image/tool");
});
test.each([false, true])(
  "app-owned provider selection controls dynamic tools: %s",
  async (selected) => {
    const root = await project();
    await installImageProvider(root, "external-image", "IMAGE_KEY");
    const applicationProvider = selected
      ? { generateImage: { appOwned: true } }
      : {};
    const source = `export const toolProviders = ${JSON.stringify(applicationProvider)};\n`;
    const integration = path.join(root, "integrations/tools/providers.ts");
    await writeFile(integration, source);
    await writeFile(
      path.join(root, "integrations/tools/execution.ts"),
      await readFile(
        path.resolve(
          import.meta.dir,
          "../../../../apps/chat/integrations/tools/execution.ts"
        ),
        "utf-8"
      )
    );
    await syncTools(root);
    const composition = requireJsonObject(
      await import(path.join(root, "integrations/tools/execution.ts")),
      "app composition"
    );
    expect(composition.tools).toEqual(applicationProvider);
    expect(await readFile(integration, "utf-8")).toBe(source);
  }
);

const installVideoProvider = async (
  root: string,
  id: string
): Promise<void> => {
  const dir = path.join(root, "chatjs/tools", id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "tool.ts"), "export const createVideo = {};");
  await writeFile(
    path.join(dir, "chatjs.json"),
    JSON.stringify({
      contractVersion: 1,
      envRequirements: [
        { options: [["VIDEO_TOKEN"], ["VIDEO_ID", "VIDEO_SECRET"]] },
        { options: [["VIDEO_REGION"]] },
      ],
      id,
      kind: "tool",
      slot: "generateVideo",
      tools: [{ toolExport: "createVideo" }],
    })
  );
};
test("image and video providers compose and reject duplicate slots", async () => {
  const root = await project();
  await installImageProvider(root, "external-image", "IMAGE_KEY");
  await installVideoProvider(root, "external-video");
  await syncTools(root);
  const selection = path.join(root, "chatjs/generated/providers.ts");
  const before = await readFile(selection, "utf-8");
  expect(before).toContain("createVideo as tool");
  expect(before).toContain("generateImage: tool");
  expect(before).toContain("generateVideo: tool");
  expect(
    await readFile(path.join(root, "chatjs/generated/providers.ts"), "utf-8")
  ).toContain("external-video");
  expect(
    await readFile(path.join(root, "chatjs/generated/ui.ts"), "utf-8")
  ).not.toContain("external-video");
  await installVideoProvider(root, "second-video");
  expect(syncTools(root)).rejects.toThrow("Only one generateVideo");
  expect(await readFile(selection, "utf-8")).toBe(before);
  await rm(path.join(root, "chatjs/tools/external-video"), {
    recursive: true,
  });
  await rm(path.join(root, "chatjs/tools/second-video"), { recursive: true });
  await syncTools(root);
  expect(await readFile(selection, "utf-8")).not.toContain("generateVideo:");
  await writeFile(selection, "// user code");
  expect(syncTools(root)).rejects.toThrow("custom or legacy");
});

test("tools register natively and app-owned composition may explicitly replace a tool", async () => {
  const root = await project();
  await install(root, "native-counter", "countWords");
  await syncTools(root);
  const toolModule = requireJsonObject(
    await import(path.join(root, "chatjs/generated/tools.ts")),
    "tool module"
  );
  const tools = requireJsonObject(toolModule.installedTools, "tool exports");
  const uiModule = requireJsonObject(
    await import(path.join(root, "chatjs/generated/ui.ts")),
    "UI module"
  );
  const ui = requireJsonObject(uiModule.installedToolUi, "UI exports");
  expect(Object.keys(tools)).toEqual(["countWords"]);
  expect(Object.keys(ui)).toEqual(["tool-countWords"]);
  await writeFile(
    path.join(root, "integrations/tools/execution.ts"),
    "export const tools = { countWords: {} };\n"
  );
  const before = await readFile(
    path.join(root, "chatjs/generated/tools.ts"),
    "utf-8"
  );
  await syncTools(root);
  expect(
    await readFile(path.join(root, "integrations/tools/execution.ts"), "utf-8")
  ).toBe("export const tools = { countWords: {} };\n");
  expect(
    await readFile(path.join(root, "chatjs/generated/tools.ts"), "utf-8")
  ).toBe(before);
});

test("sync preserves request-context auth and environment credential fallbacks", async () => {
  const root = await project();
  await installVideoProvider(root, "vercel-video");
  const descriptor = path.join(root, "chatjs/tools/vercel-video/chatjs.json");
  const definition = toolDefinitionSchema.parse(
    JSON.parse(await readFile(descriptor, "utf-8"))
  );
  assert.ok(
    definition.envRequirements?.[0] !== undefined,
    "video fixture requires an environment requirement"
  );
  definition.envRequirements[0].runtimeAuth = "vercel-oidc";
  await writeFile(descriptor, JSON.stringify(definition));
  const definitions = await syncTools(root);
  expect(definitions[0]?.envRequirements).toEqual([
    {
      options: [["VIDEO_TOKEN"], ["VIDEO_ID", "VIDEO_SECRET"]],
      runtimeAuth: "vercel-oidc",
    },
    { options: [["VIDEO_REGION"]] },
  ]);
});

test("a bundle registers each native tool and renderer and rejects cross-bundle collisions", async () => {
  const root = await project();
  const dir = path.join(root, "chatjs/tools/report-tools");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "chatjs.json"),
    JSON.stringify({
      contractVersion: 1,
      id: "report-tools",
      kind: "tool",
      tools: [
        {
          rendererExport: "ReportRenderer",
          toolExport: "createReport",
        },
        { rendererExport: "ReportRenderer", toolExport: "reviseReport" },
      ],
    })
  );
  await writeFile(
    path.join(dir, "tool.ts"),
    "export const createReport = {}; export const reviseReport = {};"
  );
  await writeFile(
    path.join(dir, "renderer.tsx"),
    "export const ReportRenderer = () => null;"
  );
  await syncTools(root);
  const toolModule = requireJsonObject(
    await import(path.join(root, "chatjs/generated/tools.ts")),
    "tool module"
  );
  const tools = requireJsonObject(toolModule.installedTools, "tool exports");
  const uiModule = requireJsonObject(
    await import(path.join(root, "chatjs/generated/ui.ts")),
    "UI module"
  );
  const ui = requireJsonObject(uiModule.installedToolUi, "UI exports");
  expect(Object.keys(tools)).toEqual(["createReport", "reviseReport"]);
  expect(Object.keys(ui)).toEqual(["tool-createReport", "tool-reviseReport"]);
  await install(root, "other", "reviseReport");
  expect(syncTools(root)).rejects.toThrow("Duplicate installed");
});

test("sync rejects removing a dependency but permits uninstalling a complete bundle", async () => {
  const root = await project();
  await install(root, "fetch-data", "fetchData");
  await install(root, "report-tools", "createReport");
  const descriptor = path.join(root, "chatjs/tools/report-tools/chatjs.json");
  const definition = toolDefinitionSchema.parse(
    JSON.parse(await readFile(descriptor, "utf-8"))
  );
  definition.requiresTools = ["fetchData"];
  await writeFile(descriptor, JSON.stringify(definition));
  await syncTools(root);
  const index = path.join(root, "chatjs/generated/tools.ts");
  const before = await readFile(index, "utf-8");
  await rm(path.join(root, "chatjs/tools/fetch-data"), { recursive: true });
  expect(syncTools(root)).rejects.toThrow(
    "requires installed tools: fetchData"
  );
  expect(syncTools(root, { checkOnly: true })).rejects.toThrow(
    "requires installed tools: fetchData"
  );
  expect(await readFile(index, "utf-8")).toBe(before);
  await rm(path.join(root, "chatjs/tools/report-tools"), { recursive: true });
  await syncTools(root);
  expect(await readFile(index, "utf-8")).not.toContain("createReport");
});

test("workflow installs stay static and reserve their names for app composition", async () => {
  const root = await project();
  const dir = path.join(root, "chatjs/tools/workflow");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "tool.ts"),
    'export { default as research } from "@/agent/tools/research";'
  );
  await writeFile(
    path.join(dir, "chatjs.json"),
    JSON.stringify({
      contractVersion: 1,
      id: "workflow",
      kind: "tool",
      tools: [{ toolExport: "research", workflow: true }],
    })
  );
  expect(syncTools(root)).rejects.toThrow();
  await mkdir(path.join(root, "agent/tools"), { recursive: true });
  await writeFile(
    path.join(root, "agent/tools/research.ts"),
    'export default { execute: () => "report" };'
  );
  await syncTools(root);
  const names = requireJsonObject(
    await import(path.join(root, "chatjs/generated/installed-tools.ts")),
    "installed names"
  );
  expect(names.installedWorkflowToolNames).toEqual(new Set(["research"]));
  await writeFile(
    path.join(root, "integrations/tools/providers.ts"),
    await readFile(
      path.resolve(
        import.meta.dir,
        "../../../../apps/chat/integrations/tools/providers.ts"
      ),
      "utf-8"
    )
  );
  const appTools = await readFile(
    path.resolve(
      import.meta.dir,
      "../../../../apps/chat/integrations/tools/execution.ts"
    ),
    "utf-8"
  );
  await writeFile(
    path.join(root, "integrations/tools/execution.ts"),
    appTools.replace("...toolProviders", "...toolProviders, research: {}")
  );
  const build = await Bun.build({
    entrypoints: [path.join(root, "integrations/tools/execution.ts")],
    target: "bun",
    tsconfig: path.join(root, "tsconfig.json"),
  });
  expect(build.success).toBe(true);
  const compiled = path.join(root, "check-tools.mjs");
  await writeFile(compiled, await build.outputs[0].text());
  const result = Bun.spawnSync([process.execPath, compiled]);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain(
    "Dynamic tools conflict with the native workflow tool: research"
  );
  const toolModule = requireJsonObject(
    await import(path.join(root, "chatjs/generated/tools.ts")),
    "tool module"
  );
  const tools = requireJsonObject(toolModule.installedTools, "tool exports");
  expect(Object.keys(tools)).toEqual([]);
  expect(
    await readFile(
      path.join(root, "chatjs/generated/workflow-types.ts"),
      "utf-8"
    )
  ).toContain("research: typeof workflow0");
  await rm(path.join(dir, "chatjs.json"));
  expect(syncTools(root)).rejects.toThrow("Missing descriptor");
});

test("composer metadata follows installation and removal without editing UI order", async () => {
  const root = await project();
  await install(root);
  const descriptor = path.join(root, "chatjs/tools/text-stats/chatjs.json");
  const definition = toolDefinitionSchema.parse(
    JSON.parse(await readFile(descriptor, "utf-8"))
  );
  definition.tools[0].composer = {
    icon: "Hash",
    name: "Count words",
    shortName: "Words",
  };
  await writeFile(descriptor, JSON.stringify(definition));
  const order = path.join(root, "composer-controls.ts");
  await writeFile(order, "// Application-owned ordering\n");
  await syncTools(root);
  const generated = path.join(root, "chatjs/generated/composer-tools.ts");
  const before = await readFile(generated, "utf-8");
  expect(before).toContain('import { Hash as Icon0 } from "lucide-react"');
  expect(before).toContain(
    '"textStats": { icon: Icon0, name: "Count words", shortName: "Words" }'
  );
  await syncTools(root);
  expect(await readFile(generated, "utf-8")).toBe(before);
  await rm(path.join(root, "chatjs/tools/text-stats"), { recursive: true });
  await syncTools(root);
  expect(await readFile(generated, "utf-8")).not.toContain("textStats");
  expect(await readFile(order, "utf-8")).toBe(
    "// Application-owned ordering\n"
  );
});

test("invalid composer icon is rejected before generated files change", async () => {
  const root = await project();
  await install(root);
  await syncTools(root);
  const generated = path.join(root, "chatjs/generated/composer-tools.ts");
  const before = await readFile(generated, "utf-8");
  const descriptor = path.join(root, "chatjs/tools/text-stats/chatjs.json");
  const definition = toolDefinitionSchema.parse(
    JSON.parse(await readFile(descriptor, "utf-8"))
  );
  definition.tools[0].composer = {
    icon: "NotALucideIcon",
    name: "Count words",
    shortName: "Words",
  };
  await writeFile(descriptor, JSON.stringify(definition));
  expect(syncTools(root)).rejects.toThrow("icon");
  expect(await readFile(generated, "utf-8")).toBe(before);
});

test.each(["GlobeIcon", "BookOpen", "Edit3"])(
  "composer icon validation accepts %s",
  async (icon) => {
    const root = await project();
    await install(root);
    const descriptor = path.join(root, "chatjs/tools/text-stats/chatjs.json");
    const definition = toolDefinitionSchema.parse(
      JSON.parse(await readFile(descriptor, "utf-8"))
    );
    definition.tools[0].composer = {
      icon,
      name: "Count words",
      shortName: "Words",
    };
    await writeFile(descriptor, JSON.stringify(definition));
    await syncTools(root);
    expect(
      await readFile(
        path.join(root, "chatjs/generated/composer-tools.ts"),
        "utf-8"
      )
    ).toContain(`${icon} as Icon0`);
  }
);

test("grouped tool and composer imports keep bindings attached beyond nine aliases", async () => {
  const root = await project();
  const directory = path.join(root, "chatjs/tools/composer-fixture");
  await mkdir(directory, { recursive: true });
  const tools = Array.from({ length: 11 }, (value, index) => ({
    composer: {
      icon: index % 2 === 0 ? "Globe" : "Wrench",
      name: `Tool ${index}`,
      shortName: `Tool ${index}`,
    },
    toolExport: `tool${index}`,
  }));
  await writeFile(
    path.join(directory, "chatjs.json"),
    JSON.stringify({
      contractVersion: 1,
      id: "composer-fixture",
      kind: "tool",
      tools: tools.toReversed(),
    })
  );
  await writeFile(
    path.join(directory, "tool.ts"),
    tools
      .map(
        (tool: { readonly toolExport: string }) =>
          `export const ${tool.toolExport} = {};`
      )
      .join("\n")
  );
  await syncTools(root);
  const toolRegistry = await readFile(
    path.join(root, "chatjs/generated/tools.ts"),
    "utf-8"
  );
  expect(toolRegistry.indexOf("tool0 as tool10")).toBeLessThan(
    toolRegistry.indexOf("tool8 as tool2")
  );
  expect(toolRegistry).toContain("tool10 as tool0");
  expect(toolRegistry).toContain("tool0: tool10");
  expect(toolRegistry).toContain("tool10: tool0");
  const file = path.join(root, "chatjs/generated/composer-tools.ts");
  const generated = await readFile(file, "utf-8");
  expect(generated.indexOf("Wrench as Icon10")).toBeLessThan(
    generated.indexOf("Globe as Icon2")
  );
  expect(generated).toContain(
    '"tool10": { icon: Icon2, name: "Tool 10", shortName: "Tool 10" }'
  );
  expect(generated).toContain(
    '"tool2": { icon: Icon3, name: "Tool 2", shortName: "Tool 2" }'
  );
  expect(generated).not.toContain("sort-imports");
  await syncTools(root, { checkOnly: true });
  await syncTools(root);
  expect(await readFile(file, "utf-8")).toBe(generated);
});
