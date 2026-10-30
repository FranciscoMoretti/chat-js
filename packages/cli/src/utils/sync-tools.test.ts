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
  id = "word-count",
  toolExport = "wordCount"
): Promise<void> => {
  const dir = path.join(root, "tools/chatjs", id);
  await mkdir(dir, { recursive: true });
  const definition = {
    contractVersion: 1,
    envRequirements: [],
    id,
    kind: "tool",
    tools: [{ rendererExport: "WordCountRenderer", toolExport }],
  };
  await writeFile(path.join(dir, "chatjs.json"), JSON.stringify(definition));
  await writeFile(
    path.join(dir, "tool.ts"),
    `export const ${toolExport} = {};`
  );
  await writeFile(
    path.join(dir, "renderer.tsx"),
    "export const WordCountRenderer = () => null;"
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
  expect(emptyTools).toContain("const installed = defineToolSet({});");
  expect(
    await readFile(path.join(root, "chatjs/generated/providers.ts"), "utf-8")
  ).toContain("export const providers = defineToolSet({});");
  expect(
    await readFile(path.join(root, "chatjs/generated/ui.ts"), "utf-8")
  ).toContain("const installed = {};");
  await install(root);
  const custom = path.join(root, "composition/custom/custom-tools.ts");
  await writeFile(custom, "export const customTools = { custom: {} };\n");
  await syncTools(root);
  const before = await readFile(
    path.join(root, "chatjs/generated/tools.ts"),
    "utf-8"
  );
  expect(before).toContain('from "@/tools/chatjs/word-count/tool"');
  expect(before).not.toContain("import { providers }");
  expect(before).toContain("Object.hasOwn");
  const installedBefore = await readFile(
    path.join(root, "chatjs/generated/installed-tools.ts"),
    "utf-8"
  );
  const [header, contentHash, ...body] = installedBefore.split("\n");
  expect(header).toContain("Generated by chat-js sync");
  expect(contentHash).toBe(
    `// Content: ${new Bun.CryptoHasher("sha256").update(body.join("\n")).digest("hex")}`
  );
  expect(installedBefore).toContain(
    "export { installedToolNames, installedDocumentKinds };"
  );
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
  const tools = requireJsonObject(toolModule.tools, "tool exports");
  const uiModule = requireJsonObject(
    await import(path.join(root, "chatjs/generated/ui.ts")),
    "UI module"
  );
  const ui = requireJsonObject(uiModule.ui, "UI exports");
  expect(Object.keys(tools)).toEqual(["alpha", "zebra"]);
  expect(Object.keys(ui)).toEqual(["tool-alpha", "tool-zebra"]);
  const { alpha } = requireJsonObject(
    await import(path.join(root, "tools/chatjs/z-tool/tool.ts")),
    "alpha module"
  );
  const { zebra } = requireJsonObject(
    await import(path.join(root, "tools/chatjs/a-tool/tool.ts")),
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
  await rm(path.join(root, "tools/chatjs/word-count/chatjs.json"));
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
  await rm(path.join(root, "tools/chatjs/other"), { recursive: true });
  await symlink(
    path.join(root, "tools/chatjs/word-count"),
    path.join(root, "tools/chatjs/other")
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
const installSearch = async (
  root: string,
  id: string,
  key: string
): Promise<void> => {
  const dir = path.join(root, "tools/chatjs", id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "tool.ts"), "export const webSearch = {};");
  await writeFile(
    path.join(dir, "chatjs.json"),
    JSON.stringify({
      contractVersion: 1,
      envRequirements: [{ options: [[key]] }],
      id,
      kind: "tool",
      slot: "webSearch",
      tools: [{ toolExport: "webSearch" }],
    })
  );
};
test("search selections register standard tools without requiring a renderer", async () => {
  const root = await project();
  await installSearch(root, "external-search", "EXTERNAL_SEARCH_KEY");
  const definitions = await syncTools(root);
  expect(definitions[0]?.envRequirements).toEqual([
    { options: [["EXTERNAL_SEARCH_KEY"]] },
  ]);
  expect(
    await readFile(path.join(root, "chatjs/generated/providers.ts"), "utf-8")
  ).toContain("@/tools/chatjs/external-search/tool");
  expect(
    readFile(path.join(root, "tools/chatjs/search-config.ts"), "utf-8")
  ).rejects.toMatchObject({ code: "ENOENT" });
  expect(
    await readFile(path.join(root, "chatjs/generated/tools.ts"), "utf-8")
  ).toContain("providers.webSearch");
  expect(
    await readFile(path.join(root, "chatjs/generated/ui.ts"), "utf-8")
  ).not.toContain("external-search");
  await installSearch(root, "another-search", "ANOTHER_KEY");
  expect(syncTools(root)).rejects.toThrow("Only one webSearch");
  await rm(path.join(root, "tools/chatjs/external-search"), {
    recursive: true,
  });
  await syncTools(root);
  expect(
    await readFile(path.join(root, "chatjs/generated/providers.ts"), "utf-8")
  ).not.toContain("external-search/tool");
});
const installExecution = async (root: string, id: string): Promise<void> => {
  const dir = path.join(root, "tools/chatjs", id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "tool.ts"), "export const runCode = {};");
  await writeFile(
    path.join(dir, "chatjs.json"),
    JSON.stringify({
      contractVersion: 1,
      envRequirements: [
        { options: [["RUNNER_TOKEN"], ["RUNNER_ID", "RUNNER_SECRET"]] },
        { options: [["RUNNER_REGION"]] },
      ],
      id,
      kind: "tool",
      slot: "codeExecution",
      tools: [{ toolExport: "runCode" }],
    })
  );
};
test("external execution tools compose with search and reject duplicate providers", async () => {
  const root = await project();
  await installSearch(root, "external-search", "SEARCH_KEY");
  await installExecution(root, "external-runner");
  await syncTools(root);
  const selection = path.join(root, "chatjs/generated/providers.ts");
  const before = await readFile(selection, "utf-8");
  expect(before).toContain("runCode as tool");
  expect(before).toContain("codeExecution: tool");
  expect(
    await readFile(path.join(root, "chatjs/generated/providers.ts"), "utf-8")
  ).toContain("external-runner");
  expect(
    await readFile(path.join(root, "chatjs/generated/ui.ts"), "utf-8")
  ).not.toContain("external-runner");
  await installExecution(root, "second-runner");
  expect(syncTools(root)).rejects.toThrow("Only one codeExecution");
  expect(await readFile(selection, "utf-8")).toBe(before);
  await rm(path.join(root, "tools/chatjs/external-runner"), {
    recursive: true,
  });
  await rm(path.join(root, "tools/chatjs/second-runner"), { recursive: true });
  await syncTools(root);
  expect(await readFile(selection, "utf-8")).not.toContain("codeExecution:");
  await writeFile(selection, "// user code");
  expect(syncTools(root)).rejects.toThrow("custom or legacy");
});

test("URL retrieval uses the selected export and rejects duplicate providers", async () => {
  const root = await project();
  const installRetrieval = async (id: string): Promise<void> => {
    const dir = path.join(root, "tools/chatjs", id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "tool.ts"), "export const readPage = {};");
    await writeFile(
      path.join(dir, "chatjs.json"),
      JSON.stringify({
        contractVersion: 1,
        envRequirements: [{ options: [["PAGE_TOKEN"]] }],
        id,
        kind: "tool",
        slot: "retrieveUrl",
        tools: [{ toolExport: "readPage" }],
      })
    );
  };
  await installRetrieval("custom-retrieval");
  await syncTools(root);
  const server = await readFile(
    path.join(root, "chatjs/generated/providers.ts"),
    "utf-8"
  );
  expect(server).toContain("readPage as tool");
  expect(server).toContain("retrieveUrl: tool");
  await installRetrieval("second-retrieval");
  expect(syncTools(root)).rejects.toThrow("Only one retrieveUrl");
  expect(
    await readFile(path.join(root, "chatjs/generated/providers.ts"), "utf-8")
  ).toBe(server);
});
test("tools register natively, retain renderers and cannot collide with custom tools", async () => {
  const root = await project();
  await install(root, "native-counter", "countWords");
  await syncTools(root);
  const toolModule = requireJsonObject(
    await import(path.join(root, "chatjs/generated/tools.ts")),
    "tool module"
  );
  const tools = requireJsonObject(toolModule.tools, "tool exports");
  const uiModule = requireJsonObject(
    await import(path.join(root, "chatjs/generated/ui.ts")),
    "UI module"
  );
  const ui = requireJsonObject(uiModule.ui, "UI exports");
  expect(Object.keys(tools)).toEqual(["countWords"]);
  expect(Object.keys(ui)).toEqual(["tool-countWords"]);
  await writeFile(
    path.join(root, "composition/custom/custom-tools.ts"),
    "export const customTools = { countWords: {} };\n"
  );
  const before = await readFile(
    path.join(root, "chatjs/generated/tools.ts"),
    "utf-8"
  );
  expect(syncTools(root)).rejects.toThrow("Custom tools conflict");
  expect(
    await readFile(path.join(root, "chatjs/generated/tools.ts"), "utf-8")
  ).toBe(before);
});

test("sync preserves request-context auth and environment credential fallbacks", async () => {
  const root = await project();
  await installExecution(root, "vercel-runner");
  const descriptor = path.join(root, "tools/chatjs/vercel-runner/chatjs.json");
  const definition = toolDefinitionSchema.parse(
    JSON.parse(await readFile(descriptor, "utf-8"))
  );
  assert.ok(
    definition.envRequirements?.[0] !== undefined,
    "execution fixture requires an environment requirement"
  );
  definition.envRequirements[0].runtimeAuth = "vercel-oidc";
  await writeFile(descriptor, JSON.stringify(definition));
  const definitions = await syncTools(root);
  expect(definitions[0]?.envRequirements).toEqual([
    {
      options: [["RUNNER_TOKEN"], ["RUNNER_ID", "RUNNER_SECRET"]],
      runtimeAuth: "vercel-oidc",
    },
    { options: [["RUNNER_REGION"]] },
  ]);
});

test("a bundle registers each native tool and renderer and rejects cross-bundle collisions", async () => {
  const root = await project();
  const dir = path.join(root, "tools/chatjs/text-documents");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "chatjs.json"),
    JSON.stringify({
      contractVersion: 1,
      id: "text-documents",
      kind: "tool",
      tools: [
        {
          rendererExport: "DocumentRenderer",
          toolExport: "createTextDocument",
        },
        { rendererExport: "DocumentRenderer", toolExport: "editTextDocument" },
      ],
    })
  );
  await writeFile(
    path.join(dir, "tool.ts"),
    "export const createTextDocument = {}; export const editTextDocument = {};"
  );
  await writeFile(
    path.join(dir, "renderer.tsx"),
    "export const DocumentRenderer = () => null;"
  );
  await syncTools(root);
  const toolModule = requireJsonObject(
    await import(path.join(root, "chatjs/generated/tools.ts")),
    "tool module"
  );
  const tools = requireJsonObject(toolModule.tools, "tool exports");
  const uiModule = requireJsonObject(
    await import(path.join(root, "chatjs/generated/ui.ts")),
    "UI module"
  );
  const ui = requireJsonObject(uiModule.ui, "UI exports");
  expect(Object.keys(tools)).toEqual([
    "createTextDocument",
    "editTextDocument",
  ]);
  expect(Object.keys(ui)).toEqual([
    "tool-createTextDocument",
    "tool-editTextDocument",
  ]);
  await install(root, "other", "editTextDocument");
  expect(syncTools(root)).rejects.toThrow("Duplicate installed");
});

test("sync rejects removing a dependency but permits uninstalling a complete bundle", async () => {
  const root = await project();
  await install(root, "read-document", "readDocument");
  await install(root, "text-documents", "createTextDocument");
  const descriptor = path.join(root, "tools/chatjs/text-documents/chatjs.json");
  const definition = toolDefinitionSchema.parse(
    JSON.parse(await readFile(descriptor, "utf-8"))
  );
  definition.requiresTools = ["readDocument"];
  await writeFile(descriptor, JSON.stringify(definition));
  await syncTools(root);
  const index = path.join(root, "chatjs/generated/tools.ts");
  const before = await readFile(index, "utf-8");
  await rm(path.join(root, "tools/chatjs/read-document"), { recursive: true });
  expect(syncTools(root)).rejects.toThrow(
    "requires installed tools: readDocument"
  );
  expect(syncTools(root, { checkOnly: true })).rejects.toThrow(
    "requires installed tools: readDocument"
  );
  expect(await readFile(index, "utf-8")).toBe(before);
  await rm(path.join(root, "tools/chatjs/text-documents"), { recursive: true });
  await syncTools(root);
  expect(await readFile(index, "utf-8")).not.toContain("createTextDocument");
});

test("saved-code registration requires an explicitly compatible executor", async () => {
  const root = await project();
  await installExecution(root, "external-runner");
  await install(root, "saved-code-execution", "runCodeDocument");
  expect(syncTools(root)).rejects.toThrow("compatible codeExecution provider");
  const descriptor = path.join(
    root,
    "tools/chatjs/external-runner/chatjs.json"
  );
  const definition = toolDefinitionSchema.parse(
    JSON.parse(await readFile(descriptor, "utf-8"))
  );
  definition.codeExecutorExport = "executeCode";
  definition.codeExecutionCapabilities = {
    cancellation: "terminate",
    cleanup: "durable-allocation",
    files: "ephemeral",
    languages: ["python", "javascript"],
    timeout: "bounded",
    usage: "single-receipt",
  };
  await writeFile(descriptor, JSON.stringify(definition));
  await writeFile(
    path.join(root, "tools/chatjs/external-runner/tool.ts"),
    `import type { CodeExecutor } from "@/lib/eve/code-executor";
export const executeCode: CodeExecutor = async () => ({
  kind: "chatjs.tool-result",
  status: "success",
  version: 1,
  output: { chart: null, message: "executed" },
  usage: { costUsd: 0 },
});
export const runCode = {};`
  );
  await syncTools(root);
  const registration = await readFile(
    path.join(root, "chatjs/generated/code-executor.ts"),
    "utf-8"
  );
  expect(registration).toContain(
    'import { executeCode as execute } from "@/tools/chatjs/external-runner/tool"'
  );
  expect(registration).toContain(
    "codeExecutor: CodeExecutor | undefined = execute"
  );
  const { codeExecutor } = requireJsonObject(
    await import(path.join(root, "chatjs/generated/code-executor.ts")),
    "executor module"
  );
  expect(typeof codeExecutor).toBe("function");
});

test.each([false, true])(
  "workflow installs stay static and reject custom collisions: %s",
  async (collision) => {
    const root = await project();
    const dir = path.join(root, "tools/chatjs/workflow");
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
    if (collision) {
      await writeFile(
        path.join(root, "composition/custom/custom-tools.ts"),
        "export const customTools = { research: {} };\n"
      );
      expect(syncTools(root)).rejects.toThrow(
        "Custom tools conflict with installed tools: research"
      );
      return;
    }
    const toolModule = requireJsonObject(
      await import(path.join(root, "chatjs/generated/tools.ts")),
      "tool module"
    );
    const tools = requireJsonObject(toolModule.tools, "tool exports");
    expect(Object.keys(tools)).toEqual([]);
    expect(
      await readFile(
        path.join(root, "chatjs/generated/workflow-types.ts"),
        "utf-8"
      )
    ).toContain("research: typeof workflow0");
    await rm(path.join(dir, "chatjs.json"));
    expect(syncTools(root)).rejects.toThrow("Missing descriptor");
  }
);

test("composer metadata follows installation and removal without editing UI order", async () => {
  const root = await project();
  await install(root);
  const descriptor = path.join(root, "tools/chatjs/word-count/chatjs.json");
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
    '"wordCount": { icon: Icon0, name: "Count words", shortName: "Words" }'
  );
  await syncTools(root);
  expect(await readFile(generated, "utf-8")).toBe(before);
  await rm(path.join(root, "tools/chatjs/word-count"), { recursive: true });
  await syncTools(root);
  expect(await readFile(generated, "utf-8")).not.toContain("wordCount");
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
  const descriptor = path.join(root, "tools/chatjs/word-count/chatjs.json");
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
    const descriptor = path.join(root, "tools/chatjs/word-count/chatjs.json");
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
  const directory = path.join(root, "tools/chatjs/composer-fixture");
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
