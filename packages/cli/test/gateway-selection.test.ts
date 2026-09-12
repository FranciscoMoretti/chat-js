import { afterAll, beforeAll, expect, it } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";
import { fileURLToPath } from "node:url";

import gatewayPackage from "@chat-js/gateways/package.json";

import { gatewayMetadata } from "../../registry/src/gateways/metadata";
import cliPackage from "../package.json";
import { GATEWAYS } from "../src/types";
import { externalGatewayFixture } from "./external-gateway";
import { run } from "./run-command";

const { dirname, join } = pathModule;

const originalRegistryUrl = process.env.CHATJS_REGISTRY_URL;
const root = await mkdtemp(join(tmpdir(), "chatjs-gateway-integration-"));
const packageDirectory = dirname(
  fileURLToPath(import.meta.resolve("@chat-js/gateways/package.json"))
);
const cliDirectory = join(import.meta.dir, "..");
const cliEntry = join(root, "cli/node_modules/@chat-js/cli/dist/index.js");
const archive = join(root, `chat-js-gateways-${gatewayPackage.version}.tgz`);

afterAll(async () => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      rm(root, { force: true, recursive: true }),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Gateway test cleanup timed out")),
          180_000
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
});

const executionDefinition = {
  contractVersion: 1,
  envRequirements: [{ options: [["ACME_EXECUTION_TOKEN"]] }],
  id: "acme-execution",
  kind: "tool",
  rendererExport: "CommandRenderer",
  slot: "codeExecution",
  toolExport: "runCommand",
};
const external = externalGatewayFixture();
const registryServer = Bun.serve({
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/external-storage.json") {
      return Response.json({
        dependencies: ["files-sdk@2.1.0"],
        files: [
          {
            content: `import { memory } from "files-sdk/memory";
export function createStorageAdapter(options: {bucket: string}) {
  if (!options.bucket) throw new Error("Missing bucket");
  return memory();
}`,
            path: "provider.ts",
            target: "~/lib/storage-provider.ts",
            type: "registry:file",
          },
        ],
        meta: {
          chatjs: {
            configKeys: ["bucket"],
            contractVersion: 1,
            envRequirements: [{ options: [["ACME_STORAGE_TOKEN"]] }],
            id: "acme-bucket",
            kind: "storage",
          },
        },
        name: "acme-bucket",
        type: "registry:item",
      });
    }
    if (path === "/external-execution.json") {
      return Response.json({
        dependencies: ["ai", "zod"],
        files: [
          {
            content: JSON.stringify(executionDefinition),
            path: "chatjs.json",
            target: "~/tools/chatjs/acme-execution/chatjs.json",
            type: "registry:file",
          },
          {
            content: `import { tool } from "ai";
import { z } from "zod";
export const runCommand = tool({inputSchema: z.object({command: z.string()}),
    execute: async ({command}) => ({stdout: command, exitCode: 0})});`,
            path: "tool.ts",
            target: "~/tools/chatjs/acme-execution/tool.ts",
            type: "registry:file",
          },
          {
            content: `"use client";
import type { UIToolInvocation } from "ai";
import type { runCommand } from "./tool";
export function CommandRenderer({tool}: {tool: UIToolInvocation<typeof runCommand>}) {
 return <pre>{tool.state === "output-available" ? tool.output.stdout : tool.input?.command}</pre>;
}`,
            path: "renderer.tsx",
            target: "~/tools/chatjs/acme-execution/renderer.tsx",
            type: "registry:file",
          },
        ],
        meta: { chatjs: executionDefinition },
        name: "acme-execution",
        type: "registry:item",
      });
    }
    if (path === "/external-search.json") {
      const definition = {
        contractVersion: 1,
        envRequirements: [],
        id: "acme-search",
        kind: "tool",
        slot: "webSearch",
        toolExport: "lookup",
      };
      return Response.json({
        dependencies: ["ai", "zod"],
        files: [
          {
            content: JSON.stringify(definition),
            path: "chatjs.json",
            target: "~/tools/chatjs/acme-search/chatjs.json",
            type: "registry:file",
          },
          {
            content: `import {tool} from "ai";
import {z} from "zod";
export const lookup = tool({inputSchema: z.object({query: z.string()}), execute: async ({query}) => ({documents: [{text: query, href: "https://example.com"}]})});`,
            path: "tool.ts",
            target: "~/tools/chatjs/acme-search/tool.ts",
            type: "registry:file",
          },
        ],
        meta: { chatjs: definition },
        name: "acme-search",
        type: "registry:item",
      });
    }
    if (path === "/external-retrieval.json") {
      const definition = {
        contractVersion: 1,
        envRequirements: [{ options: [["ACME_RETRIEVAL_KEY"]] }],
        id: "acme-retrieval",
        kind: "tool",
        slot: "retrieveUrl",
        toolExport: "readPage",
      };
      return Response.json({
        dependencies: ["ai", "zod"],
        files: [
          {
            content: JSON.stringify(definition),
            path: "chatjs.json",
            target: "~/tools/chatjs/acme-retrieval/chatjs.json",
            type: "registry:file",
          },
          {
            content: `import {tool} from "ai";
import {z} from "zod";
export const readPage = tool({inputSchema: z.object({target: z.string()}), execute: async ({target}) => ({text: "Page content", source: target})});`,
            path: "tool.ts",
            target: "~/tools/chatjs/acme-retrieval/tool.ts",
            type: "registry:file",
          },
        ],
        meta: { chatjs: definition },
        name: definition.id,
        type: "registry:item",
      });
    }
    if (path === "/contracts.tgz") {
      return new Response(Bun.file(archive));
    }
    if (path === "/gateway.json") {
      return Response.json({
        ...external.root,
        dependencies: external.root.dependencies.map((d) =>
          d.startsWith("@chat-js/gateways@")
            ? `@chat-js/gateways@http://127.0.0.1:${registryServer.port}/contracts.tgz`
            : d
        ),
        registryDependencies: [
          `http://127.0.0.1:${registryServer.port}/adapter.json`,
        ],
      });
    }
    if (path === "/adapter.json") {
      return Response.json(external.adapter);
    }
    if (path === "/v1/chat/completions") {
      if (request.headers.get("authorization") !== "Bearer fixture-key") {
        return new Response("Unauthorized", { status: 401 });
      }
      const body = await request.json();
      if (body.model !== "gpt-5-mini") {
        return new Response("Wrong model", { status: 400 });
      }
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            index: 0,
            message: { content: "External gateway works.", role: "assistant" },
          },
        ],
        created: 1,
        id: "fixture-response",
        model: body.model,
        object: "chat.completion",
        usage: { completion_tokens: 1, prompt_tokens: 1, total_tokens: 2 },
      });
    }
    if (/^\/[a-z0-9-]+\.json$/u.test(path)) {
      const file = Bun.file(
        join(cliDirectory, "../registry/dist/r", path.slice(1))
      );
      if (await file.exists()) {
        const item = await file.json();
        if (item.dependencies) {
          item.dependencies = item.dependencies.map((d: string) =>
            d.startsWith("@chat-js/gateways@")
              ? `@chat-js/gateways@http://127.0.0.1:${registryServer.port}/contracts.tgz`
              : d
          );
        }
        return Response.json(item);
      }
    }
    return new Response("Not found", { status: 404 });
  },
  hostname: "127.0.0.1",
  port: 0,
});

beforeAll(async () => {
  await run(packageDirectory, ["bun", "run", "build"]);
  await run(packageDirectory, ["bun", "pm", "pack", "--destination", root]);
  await run(join(cliDirectory, "../registry"), ["bun", "run", "build"]);
  const output = join(cliDirectory, "../registry/dist/r");
  const outputNames = await readdir(output);
  const names = outputNames.toSorted();
  const first = await Promise.all(
    names.map((name) => readFile(join(output, name), "utf-8"))
  );
  await run(join(cliDirectory, "../registry"), ["bun", "run", "build"]);
  const rebuiltOutputNames = await readdir(output);
  expect(rebuiltOutputNames.toSorted()).toEqual(names);
  expect(
    await Promise.all(
      names.map((name) => readFile(join(output, name), "utf-8"))
    )
  ).toEqual(first);
  await run(cliDirectory, ["bun", "run", "build"]);
  await run(cliDirectory, ["bun", "pm", "pack", "--destination", root]);
  await mkdir(join(root, "cli"));
  await writeFile(
    join(root, "cli/package.json"),
    JSON.stringify({
      dependencies: {
        "@chat-js/cli": `file:${join(root, `chat-js-cli-${cliPackage.version}.tgz`)}`,
      },
      overrides: { "@chat-js/gateways": `file:${archive}` },
      private: true,
    })
  );
  await run(join(root, "cli"), ["bun", "install"]);
  process.env.CHATJS_REGISTRY_URL = `http://127.0.0.1:${registryServer.port}/{name}.json`;
});

afterAll(() => {
  registryServer.stop(true);
  if (originalRegistryUrl === undefined) {
    delete process.env.CHATJS_REGISTRY_URL;
  } else {
    process.env.CHATJS_REGISTRY_URL = originalRegistryUrl;
  }
});

const gatewaySource = (gateway: Gateway | "acme"): string =>
  gateway === "acme"
    ? `http://127.0.0.1:${registryServer.port}/gateway.json`
    : gateway;

const storageArguments = (gateway: Gateway | "acme"): string[] => {
  if (gateway === "acme") {
    return [
      "--storage-provider",
      `http://127.0.0.1:${registryServer.port}/external-storage.json`,
      "--storage-config",
      '{"bucket":"test"}',
    ];
  }
  if (gateway === "openai") {
    return [
      "--storage-provider",
      "s3",
      "--storage-config",
      '{"bucket":"test","region":"us-east-1"}',
    ];
  }
  return [];
};

const toolArguments = (gateway: Gateway | "acme"): string[] => {
  if (gateway === "vercel") {
    return [
      "--search-tool",
      "firecrawl-search",
      "--code-execution-tool",
      "vercel-code-execution",
      "--url-retrieval-tool",
      "retrieve-url",
    ];
  }
  if (gateway === "acme") {
    return [
      "--url-retrieval-tool",
      `http://127.0.0.1:${registryServer.port}/external-retrieval.json`,
      "--code-execution-tool",
      `http://127.0.0.1:${registryServer.port}/external-execution.json`,
      "--search-tool",
      `http://127.0.0.1:${registryServer.port}/external-search.json`,
    ];
  }
  return [];
};

for (const gateway of [...GATEWAYS, "acme"]) {
  it(`${gateway}: independently installed ChatJS app typechecks and loads the registry adapter`, async () => {
    const cwd = join(root, gateway);
    await run(root, [
      "node",
      cliEntry,
      "create",
      gateway,
      "--gateway",
      gatewaySource(gateway),
      ...storageArguments(gateway),
      "--yes",
      "--no-electron",
      ...toolArguments(gateway),
    ]);
    const manifestPath = join(cwd, "package.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
    if (gateway === "vercel") {
      expect(manifest.dependencies["@vercel/sandbox"]).toBeDefined();
      expect(
        await readFile(
          join(cwd, "tools/chatjs/url-retrieval-config.ts"),
          "utf-8"
        )
      ).toContain("FIRECRAWL_API_KEY");
      expect(
        await Bun.file(join(cwd, "tools/chatjs/retrieve-url/tool.ts")).exists()
      ).toBe(true);
      expect(
        await readFile(join(cwd, "tools/chatjs/tools.ts"), "utf-8")
      ).toContain("vercel-code-execution/tool");
      expect(manifest.dependencies["@tavily/core"]).toBeUndefined();
      expect(
        await Bun.file(join(cwd, "tools/chatjs/tavily-search/tool.ts")).exists()
      ).toBe(false);
      expect(
        await readFile(join(cwd, "tools/chatjs/tools.ts"), "utf-8")
      ).toContain("firecrawl-search/tool");
      expect(
        await readFile(join(cwd, "tools/chatjs/search-config.ts"), "utf-8")
      ).toContain("FIRECRAWL_API_KEY");
    }

    const selectedSdk =
      gateway === "acme"
        ? "@ai-sdk/openai-compatible"
        : gatewayMetadata[gateway as keyof typeof gatewayMetadata].dependency;
    for (const { dependency } of Object.values(gatewayMetadata)) {
      if (dependency !== selectedSdk) {
        expect(manifest.dependencies[dependency]).toBeUndefined();
      }
    }
    // The shared npm archive must not carry any other adapter implementations.
    await Promise.all(
      GATEWAYS.map(async (name) => {
        expect(
          await Bun.file(
            join(cwd, "node_modules/@chat-js/gateways/src", `${name}.ts`)
          ).exists()
        ).toBe(false);
        expect(
          await Bun.file(
            join(cwd, "node_modules/@chat-js/gateways/dist", `${name}.js`)
          ).exists()
        ).toBe(false);
      })
    );

    if (gateway === "acme") {
      expect(manifest.dependencies["@vercel/sandbox"]).toBeUndefined();
      expect(manifest.dependencies["@tavily/core"]).toBeUndefined();
      expect(
        await Bun.file(
          join(cwd, "tools/platform/code-execution-contract.ts")
        ).exists()
      ).toBe(false);
      expect(
        await readFile(join(cwd, "tools/chatjs/ui.ts"), "utf-8")
      ).toContain("acme-execution/renderer");
      expect(
        await readFile(join(cwd, "tools/chatjs/ui.ts"), "utf-8")
      ).not.toContain("tool-webSearch");
      expect(
        await Bun.file(
          join(cwd, "tools/chatjs/vercel-code-execution/tool.ts")
        ).exists()
      ).toBe(false);
      expect(
        await readFile(
          join(cwd, "tools/chatjs/code-execution-config.ts"),
          "utf-8"
        )
      ).toContain("ACME_EXECUTION_TOKEN");
      await writeFile(
        join(cwd, "verify-execution.ts"),
        `import assert from "node:assert/strict";
import {tools} from "./tools/chatjs/tools";
const tool = tools.codeExecution;
assert.ok(tool.execute);
const result = await tool.execute({command: "echo hello"}, {toolCallId: "fixture", messages: [], context: {}});
assert.deepEqual(result, {stdout: "echo hello", exitCode: 0});
assert.ok(tools.webSearch.execute);
const search = await tools.webSearch.execute({query: "independent schema"}, {toolCallId: "search", messages: [], context: {}});
assert.deepEqual(search, {documents: [{text: "independent schema", href: "https://example.com"}]});
assert.ok(tools.retrieveUrl.execute);
const page = await tools.retrieveUrl.execute({target: "https://example.com"}, {toolCallId: "retrieve", messages: [], context: {}});
assert.deepEqual(page, {text: "Page content", source: "https://example.com"});
`
      );
      await run(cwd, ["bun", "verify-execution.ts"]);
      expect(manifest.dependencies["@mendable/firecrawl-js"]).toBeUndefined();
      expect(
        await Bun.file(join(cwd, "tools/chatjs/retrieve-url/tool.ts")).exists()
      ).toBe(false);
      expect(
        await readFile(
          join(cwd, "tools/chatjs/url-retrieval-config.ts"),
          "utf-8"
        )
      ).toContain("ACME_RETRIEVAL_KEY");
      expect(
        await readFile(join(cwd, "tools/chatjs/ui.ts"), "utf-8")
      ).not.toContain("tool-retrieveUrl");
      expect(manifest.dependencies["@vercel/blob"]).toBeUndefined();
      expect(manifest.dependencies["@aws-sdk/client-s3"]).toBeUndefined();
      await writeFile(
        join(cwd, "verify-storage.ts"),
        `import { Files } from "files-sdk";
import { createStorageAdapter } from "./lib/storage-provider";
import { storageOptions, storageId, storageEnvRequirements } from "./lib/storage-options";
import assert from "node:assert/strict";
assert.equal(storageId, "acme-bucket");
assert.equal(storageEnvRequirements[0]?.options[0]?.[0], "ACME_STORAGE_TOKEN");
const files = new Files({adapter: createStorageAdapter(storageOptions)});
await files.upload("test.txt", new Blob(["hello"]));
assert.equal(await (await files.download("test.txt")).text(), "hello");
await files.delete("test.txt");
assert.equal(await files.exists("test.txt"), false);
`
      );
      await run(cwd, ["bun", "verify-storage.ts"]);
    }
    if (gateway === "openai") {
      expect(manifest.dependencies["@aws-sdk/client-s3"]).toBeDefined();
      expect(manifest.dependencies["@vercel/blob"]).toBeUndefined();
    }

    const other = gateway === "vercel" ? "openai" : "vercel";
    await writeFile(
      join(cwd, "gateway-type-check.ts"),
      `import { defineConfig } from "./lib/config-schema";
// @ts-expect-error An uninstalled gateway must not typecheck.
defineConfig({ ai: { gateway: "${other}" } });
${
  gateway === "vercel" || gateway === "openai"
    ? `// @ts-expect-error Preserve the selected SDK's model ID type across package declarations.
defineConfig({ ai: { gateway: "${gateway}", workflows: { chat: "not-a-model" } } });`
    : ""
}
${
  gateway === "vercel"
    ? ""
    : `// @ts-expect-error This gateway cannot enable video generation.
defineConfig({ ai: { gateway: "${gateway}", tools: { video: { enabled: true, default: "video" } } } });`
}
`
    );
    if (gateway === "vercel") {
      await run(cwd, ["node", cliEntry, "add", "word-count", "--yes"]);
      const index = await readFile(join(cwd, "tools/chatjs/tools.ts"), "utf-8");
      await run(cwd, ["node", cliEntry, "add", "word-count", "--yes"]);
      expect(await readFile(join(cwd, "tools/chatjs/tools.ts"), "utf-8")).toBe(
        index
      );
      await run(cwd, [
        "bunx",
        "--bun",
        "shadcn@4.21.0",
        "add",
        "@chatjs/get-weather",
        "--yes",
      ]);
      await run(cwd, ["node", cliEntry, "sync"]);
      expect(
        await readFile(join(cwd, "tools/chatjs/tools.ts"), "utf-8")
      ).toContain("getWeather as tool");
    }
    await run(cwd, ["bun", "run", "test:types"]);
    await writeFile(
      join(cwd, "probe.ts"),
      `import { Gateway } from "./lib/ai/gateway";
import assert from "node:assert/strict";
assert.equal(new Gateway().type, "${gateway}");
`
    );
    await run(cwd, ["bunx", "--no-install", "tsx", "probe.ts"]);

    if (gateway === "acme") {
      await writeFile(
        join(cwd, "probe-generation.ts"),
        `import assert from "node:assert/strict";
import { generateText } from "ai";
process.env.DATABASE_URL = "postgres://fixture:fixture@127.0.0.1/fixture";
process.env.AUTH_SECRET = "fixture-secret";
process.env.ACME_BASE_URL = "http://127.0.0.1:${registryServer.port}/v1";
process.env.ACME_API_KEY = "fixture-key";
const { getActiveGateway } = await import("./lib/ai/active-gateway");
const result = await generateText({ model: getActiveGateway().createLanguageModel("gpt-5-mini"), prompt: "Hello" });
assert.equal(result.text, "External gateway works.");
`
      );
      await run(cwd, ["bunx", "--no-install", "tsx", "probe-generation.ts"]);
    }

    // Parse the actual generated config, including model defaults, without provider calls.
    await writeFile(
      join(cwd, "probe-config.ts"),
      `import { getProvider } from "files-sdk/providers";
import config from "./chat.config";
import { applyDefaults, aiConfigSchema } from "./lib/config-schema";
import assert from "node:assert/strict";
assert.ok(getProvider("vercel-blob"));
assert.equal(applyDefaults(config).ai.gateway, "${gateway}");
assert.equal(aiConfigSchema.safeParse({ ...applyDefaults(config).ai, gateway: "${other}" }).success, false);
${
  gateway === "vercel"
    ? ""
    : `const ai = applyDefaults(config).ai;
assert.equal(aiConfigSchema.safeParse({ ...ai, tools: { ...ai.tools, video: { enabled: true, default: "video" } } }).success, false);`
}

`
    );
    await run(cwd, ["bunx", "--no-install", "tsx", "probe-config.ts"]);
    if (gateway === "vercel") {
      await Promise.all(
        ["gateway-type-check.ts", "probe.ts", "probe-config.ts"].map((name) =>
          rm(join(cwd, name))
        )
      );
      await run(cwd, ["bun", "run", "lint"]);
      const longDirectory = join(cwd, "tools/chatjs/long-renderer");
      await mkdir(longDirectory);
      const toolExport =
        "wordCountWithAnIntentionallyLongNameForFormattingVerification";
      const rendererExport =
        "WordCountRendererWithAnIntentionallyLongNameForFormattingVerification";
      await writeFile(
        join(longDirectory, "tool.ts"),
        `export { wordCount as ${toolExport} } from "../word-count/tool";`
      );
      await writeFile(
        join(longDirectory, "renderer.tsx"),
        `export { WordCountRenderer as ${rendererExport} } from "../word-count/renderer";`
      );
      await writeFile(
        join(longDirectory, "chatjs.json"),
        JSON.stringify({
          contractVersion: 1,
          id: "long-renderer",
          kind: "tool",
          rendererExport,
          toolExport,
        })
      );
      await run(cwd, ["node", cliEntry, "sync"]);
      await run(cwd, ["bun", "run", "format"]);
      await run(cwd, ["node", cliEntry, "sync"]);
      await run(cwd, ["bun", "run", "lint"]);
    }
    expect(
      await Bun.file(
        join(cwd, "lib/ai/gateways/openrouter-gateway.ts")
      ).exists()
    ).toBe(false);
  }, 180_000);
}
