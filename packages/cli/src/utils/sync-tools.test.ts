import { afterEach, expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { syncTools } from "./sync-tools";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function project() {
  const root = await mkdtemp(join(tmpdir(), "chatjs-sync-"));
  roots.push(root);
  await syncTools(root);
  return root;
}
async function install(
  root: string,
  id = "word-count",
  toolExport = "wordCount"
) {
  const dir = join(root, "tools/chatjs", id);
  await mkdir(dir, { recursive: true });
  const definition = {
    contractVersion: 1,
    kind: "tool",
    id,
    toolExport,
    rendererExport: "WordCountRenderer",
    envRequirements: [],
  };
  await writeFile(join(dir, "chatjs.json"), JSON.stringify(definition));
  await writeFile(join(dir, "tool.ts"), `export const ${toolExport} = {};`);
  await writeFile(
    join(dir, "renderer.tsx"),
    "export const WordCountRenderer = () => null;"
  );
}
test("sync registers direct installs deterministically and preserves custom modules", async () => {
  const root = await project();
  await install(root);
  const custom = join(root, "tools/chatjs/custom-tools.ts");
  await writeFile(custom, "export const customTools = { custom: {} };\n");
  await syncTools(root);
  const before = await readFile(join(root, "tools/chatjs/tools.ts"), "utf8");
  expect(before).toContain('from "./word-count/tool"');
  expect(before).toContain("Object.hasOwn");
  await syncTools(root);
  expect(await readFile(join(root, "tools/chatjs/tools.ts"), "utf8")).toBe(
    before
  );
  expect(await readFile(custom, "utf8")).toContain("custom: {}");
});
test("missing descriptors and edited generated output fail without dropping registrations", async () => {
  const root = await project();
  await install(root);
  await syncTools(root);
  const index = join(root, "tools/chatjs/tools.ts");
  const before = await readFile(index, "utf8");
  await rm(join(root, "tools/chatjs/word-count/chatjs.json"));
  await expect(syncTools(root)).rejects.toThrow("Missing descriptor");
  expect(await readFile(index, "utf8")).toBe(before);
  await writeFile(index, `${before}\n// custom edit`);
  await expect(syncTools(root)).rejects.toThrow("custom or legacy");
});
test("duplicate keys and symlink directories fail before writing indexes", async () => {
  const root = await project();
  await install(root);
  await install(root, "other");
  await expect(syncTools(root)).rejects.toThrow("Duplicate installed");
  await rm(join(root, "tools/chatjs/other"), { recursive: true });
  await symlink(
    join(root, "tools/chatjs/word-count"),
    join(root, "tools/chatjs/other")
  );
  await expect(syncTools(root)).rejects.toThrow("symlinks");
});
test("known legacy registrations bootstrap descriptors without changing source", async () => {
  const root = await project();
  await install(root);
  await rm(join(root, "tools/chatjs/word-count/chatjs.json"));
  await writeFile(
    join(root, "tools/chatjs/tools.ts"),
    'import { wordCount } from "@/tools/chatjs/word-count/tool";\nexport const tools = { wordCount, } as const;'
  );
  await writeFile(
    join(root, "tools/chatjs/ui.ts"),
    'import type { ToolRendererRegistry } from "@/lib/ai/tool-renderer-registry";\nimport { WordCountRenderer } from "@/tools/chatjs/word-count/renderer";\nexport const ui = { "tool-wordCount": WordCountRenderer, } satisfies ToolRendererRegistry;'
  );
  await syncTools(root, { checkOnly: true });
  expect(
    await Bun.file(join(root, "tools/chatjs/word-count/chatjs.json")).exists()
  ).toBe(false);
  await syncTools(root);
  expect(
    JSON.parse(
      await readFile(join(root, "tools/chatjs/word-count/chatjs.json"), "utf8")
    ).toolExport
  ).toBe("wordCount");
  expect(
    await readFile(join(root, "tools/chatjs/word-count/tool.ts"), "utf8")
  ).toBe("export const wordCount = {};");
});
test("a requested tool cannot report successful registration without its descriptor", async () => {
  const root = await project();
  await expect(
    syncTools(root, {
      expected: [
        {
          contractVersion: 1,
          kind: "tool",
          id: "missing",
          toolExport: "missing",
          rendererExport: "Missing",
          envRequirements: [],
        },
      ],
    })
  ).rejects.toThrow("does not match requested");
});

test("legacy CLI empty and reverse-order indexes migrate", async () => {
  const root = await project();
  const server = join(root, "tools/chatjs/tools.ts");
  const client = join(root, "tools/chatjs/ui.ts");
  await writeFile(server, "export const tools = {} as const;");
  await writeFile(client, "export const ui = {};");
  await syncTools(root);
  await install(root);
  await install(root, "get-weather", "getWeather");
  for (const id of ["word-count", "get-weather"])
    await rm(join(root, "tools/chatjs", id, "chatjs.json"));
  await writeFile(
    server,
    'import { wordCount } from "@/tools/chatjs/word-count/tool";\nimport { getWeather } from "@/tools/chatjs/get-weather/tool";\nexport const tools = { wordCount, getWeather, } as const;'
  );
  await writeFile(
    client,
    'import { WordCountRenderer } from "@/tools/chatjs/word-count/renderer";\nimport { GetWeatherRenderer } from "@/tools/chatjs/get-weather/renderer";\nexport const ui = { "tool-wordCount": WordCountRenderer, "tool-getWeather": GetWeatherRenderer, };'
  );
  expect((await syncTools(root)).map((item) => item.id)).toEqual([
    "get-weather",
    "word-count",
  ]);
});

async function installSearch(root: string, id: string, key: string) {
  const dir = join(root, "tools/chatjs", id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "tool.ts"), "export const webSearch = {};");
  await writeFile(
    join(dir, "chatjs.json"),
    JSON.stringify({
      contractVersion: 1,
      kind: "tool",
      id,
      slot: "webSearch",
      toolExport: "webSearch",
      envRequirements: [{ options: [[key]] }],
    })
  );
}
test("search selections register standard tools without requiring a renderer", async () => {
  const root = await project();
  await installSearch(root, "external-search", "EXTERNAL_SEARCH_KEY");
  await syncTools(root);
  expect(await readFile(join(root, "tools/chatjs/tools.ts"), "utf8")).toContain(
    "./external-search/tool"
  );
  expect(
    await readFile(join(root, "tools/chatjs/search-config.ts"), "utf8")
  ).toContain("EXTERNAL_SEARCH_KEY");
  expect(await readFile(join(root, "tools/chatjs/tools.ts"), "utf8")).toContain(
    "external-search"
  );
  expect(
    await readFile(join(root, "tools/chatjs/ui.ts"), "utf8")
  ).not.toContain("external-search");
  await installSearch(root, "another-search", "ANOTHER_KEY");
  await expect(syncTools(root)).rejects.toThrow("Only one webSearch");
  await rm(join(root, "tools/chatjs/external-search"), { recursive: true });
  await syncTools(root);
  expect(
    await readFile(join(root, "tools/chatjs/search-config.ts"), "utf8")
  ).not.toContain("EXTERNAL_SEARCH_KEY");
});
test("sync protects an edited search selection", async () => {
  const root = await project();
  await writeFile(join(root, "tools/chatjs/search.ts"), "// user code");
  await expect(syncTools(root)).rejects.toThrow("custom or legacy");
});

async function installExecution(root: string, id: string) {
  const dir = join(root, "tools/chatjs", id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "tool.ts"), "export const runCode = {};");
  await writeFile(
    join(dir, "chatjs.json"),
    JSON.stringify({
      contractVersion: 1,
      kind: "tool",
      id,
      slot: "codeExecution",
      toolExport: "runCode",
      envRequirements: [
        { options: [["RUNNER_TOKEN"], ["RUNNER_ID", "RUNNER_SECRET"]] },
        { options: [["RUNNER_REGION"]] },
      ],
    })
  );
}
test("external execution tools compose with search and preserve credential alternatives", async () => {
  const root = await project();
  await installSearch(root, "external-search", "SEARCH_KEY");
  await installExecution(root, "external-runner");
  await syncTools(root);
  const selection = join(root, "tools/chatjs/tools.ts");
  const config = join(root, "tools/chatjs/code-execution-config.ts");
  const before = await readFile(selection, "utf8");
  expect(before).toContain("runCode as tool");
  expect(before).toContain("codeExecution: tool");
  const requirements = await import(config);
  expect(requirements.codeExecutionEnvRequirement.options).toEqual([
    ["RUNNER_TOKEN", "RUNNER_REGION"],
    ["RUNNER_ID", "RUNNER_SECRET", "RUNNER_REGION"],
  ]);
  expect(await readFile(join(root, "tools/chatjs/tools.ts"), "utf8")).toContain(
    "external-runner"
  );
  expect(
    await readFile(join(root, "tools/chatjs/ui.ts"), "utf8")
  ).not.toContain("external-runner");
  await installExecution(root, "second-runner");
  await expect(syncTools(root)).rejects.toThrow("Only one codeExecution");
  expect(await readFile(selection, "utf8")).toBe(before);
  await rm(join(root, "tools/chatjs/external-runner"), { recursive: true });
  await rm(join(root, "tools/chatjs/second-runner"), { recursive: true });
  await syncTools(root);
  expect(await readFile(selection, "utf8")).not.toContain("codeExecution:");
  expect(await readFile(config, "utf8")).not.toContain("RUNNER_TOKEN");
  await writeFile(selection, "// user code");
  await expect(syncTools(root)).rejects.toThrow("custom or legacy");
});

test("URL retrieval uses the selected export and credentials and rejects duplicate providers", async () => {
  const root = await project();
  const install = async (id: string) => {
    const dir = join(root, "tools/chatjs", id);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "tool.ts"), "export const readPage = {};");
    await writeFile(
      join(dir, "chatjs.json"),
      JSON.stringify({
        contractVersion: 1,
        kind: "tool",
        id,
        slot: "retrieveUrl",
        toolExport: "readPage",
        envRequirements: [{ options: [["PAGE_TOKEN"]] }],
      })
    );
  };
  await install("custom-retrieval");
  await syncTools(root);
  const server = await readFile(join(root, "tools/chatjs/tools.ts"), "utf8");
  expect(server).toContain("readPage as tool");
  expect(server).toContain("retrieveUrl: tool");
  const requirements = await readFile(
    join(root, "tools/chatjs/url-retrieval-config.ts"),
    "utf8"
  );
  expect(requirements).toContain("PAGE_TOKEN");
  expect(requirements).not.toContain("FIRECRAWL");
  await install("second-retrieval");
  await expect(syncTools(root)).rejects.toThrow("Only one retrieveUrl");
  expect(await readFile(join(root, "tools/chatjs/tools.ts"), "utf8")).toBe(
    server
  );
});
