import { run } from "./run-command";
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
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gatewayMetadata } from "../../registry/src/gateways/metadata";
import cliPackage from "../package.json";
import gatewayPackage from "@chat-js/gateways/package.json";
import { externalGatewayFixture } from "./external-gateway";
import { GATEWAYS } from "../src/types";

const originalRegistryUrl = process.env.CHATJS_REGISTRY_URL;
const root = await mkdtemp(join(tmpdir(), "chatjs-gateway-integration-"));
const packageDirectory = dirname(
	fileURLToPath(import.meta.resolve("@chat-js/gateways/package.json")),
);
const cliDirectory = join(import.meta.dir, "..");
const cliEntry = join(root, "cli/node_modules/@chat-js/cli/dist/index.js");
const archive = join(root, `chat-js-gateways-${gatewayPackage.version}.tgz`);

beforeAll(async () => {
	await run(packageDirectory, ["bun", "run", "build"]);
	await run(packageDirectory, ["bun", "pm", "pack", "--destination", root]);
	await run(join(cliDirectory, "../registry"), ["bun", "run", "build"]);
	const output = join(cliDirectory, "../registry/dist/r");
	const names = (await readdir(output)).sort();
	const first = await Promise.all(
		names.map((name) => readFile(join(output, name), "utf8")),
	);
	await run(join(cliDirectory, "../registry"), ["bun", "run", "build"]);
	expect((await readdir(output)).sort()).toEqual(names);
	expect(
		await Promise.all(
			names.map((name) => readFile(join(output, name), "utf8")),
		),
	).toEqual(first);
	await run(cliDirectory, ["bun", "run", "build"]);
	await run(cliDirectory, ["bun", "pm", "pack", "--destination", root]);
	await mkdir(join(root, "cli"));
	await writeFile(
		join(root, "cli/package.json"),
		JSON.stringify({
			private: true,
			dependencies: {
				"@chat-js/cli": `file:${join(root, `chat-js-cli-${cliPackage.version}.tgz`)}`,
			},
			overrides: { "@chat-js/gateways": `file:${archive}` },
		}),
	);
	await run(join(root, "cli"), ["bun", "install"]);
	process.env.CHATJS_REGISTRY_URL = `http://127.0.0.1:${registryServer.port}/{name}.json`;
});

afterAll(async () => {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			rm(root, { recursive: true, force: true }),
			new Promise<never>((_, reject) => {
				timeout = setTimeout(
					() => reject(new Error("Gateway test cleanup timed out")),
					180_000,
				);
			}),
		]);
	} finally {
		clearTimeout(timeout);
	}
});

const executionDefinition = {
  contractVersion: 1, kind: "tool", id: "acme-execution", slot: "codeExecution",
  toolExport: "runCommand", rendererExport: "CommandRenderer", envRequirements: [{options: [["ACME_EXECUTION_TOKEN"]]}],
};
const external = externalGatewayFixture();
const registryServer = Bun.serve({
	port: 0,
	hostname: "127.0.0.1",
	async fetch(request) {
		const path = new URL(request.url).pathname;
    if (path === "/external-storage.json") return Response.json({
      name: "acme-bucket",
      type: "registry:item",
      dependencies: ["files-sdk@2.1.0"],
      meta: {chatjs: {kind: "storage", contractVersion: 1, id: "acme-bucket", configKeys: ["bucket"], envRequirements: [{options: [["ACME_STORAGE_TOKEN"]]}]}},
      files: [{path: "provider.ts", type: "registry:file", target: "~/lib/storage-provider.ts", content: `import { memory } from "files-sdk/memory";
export function createStorageAdapter(options: {bucket: string}) {
  if (!options.bucket) throw new Error("Missing bucket");
  return memory();
}`}],
    });
		if (path === "/external-execution.json") return Response.json({
      name: "acme-execution", type: "registry:item", dependencies: ["ai", "zod"],
      meta: {chatjs: executionDefinition},
      files: [
        {path: "chatjs.json", type: "registry:file", target: "~/tools/chatjs/acme-execution/chatjs.json", content: JSON.stringify(executionDefinition)},
        {path: "tool.ts", type: "registry:file", target: "~/tools/chatjs/acme-execution/tool.ts", content: `import { tool } from "ai";
import { z } from "zod";
export const runCommand = tool({inputSchema: z.object({command: z.string()}),
    execute: async ({command}) => ({stdout: command, exitCode: 0})});`},
        {path: "renderer.tsx", type: "registry:file", target: "~/tools/chatjs/acme-execution/renderer.tsx", content: `"use client";
import type { UIToolInvocation } from "ai";
import type { runCommand } from "./tool";
export function CommandRenderer({tool}: {tool: UIToolInvocation<typeof runCommand>}) {
 return <pre>{tool.state === "output-available" ? tool.output.stdout : tool.input?.command}</pre>;
}`},
      ],
    });
    if (path === "/external-search.json") {
      const definition = {contractVersion: 1, kind: "tool", id: "acme-search", slot: "webSearch", toolExport: "lookup", envRequirements: []};
      return Response.json({name: "acme-search", type: "registry:item", dependencies: ["ai", "zod"], meta: {chatjs: definition}, files: [
        {path: "chatjs.json", type: "registry:file", target: "~/tools/chatjs/acme-search/chatjs.json", content: JSON.stringify(definition)},
        {path: "tool.ts", type: "registry:file", target: "~/tools/chatjs/acme-search/tool.ts", content: `import {tool} from "ai";
import {z} from "zod";
export const lookup = tool({inputSchema: z.object({query: z.string()}), execute: async ({query}) => ({documents: [{text: query, href: "https://example.com"}]})});`},
      ]});
    }
    if (path === "/external-image.json") {
      const definition = { contractVersion: 1, kind: "tool", id: "acme-image", slot: "generateImage", toolExport: "paint", envRequirements: [{ options: [["ACME_IMAGE_KEY"]] }] };
      return Response.json({ name: "acme-image", type: "registry:item", dependencies: ["ai", "zod"], meta: { chatjs: definition }, files: [
        { path: "tool.ts", target: "~/tools/chatjs/acme-image/tool.ts", type: "registry:file", content: 'import { tool } from "ai"; import { z } from "zod"; export const paint = tool({ inputSchema: z.object({ subject: z.string() }), execute: async ({subject}) => ({ asset: subject }) });' },
        { path: "chatjs.json", target: "~/tools/chatjs/acme-image/chatjs.json", type: "registry:file", content: JSON.stringify(definition) },
      ] });
    }
    if (path === "/external-retrieval.json") {
      const definition = { contractVersion: 1, kind: "tool", id: "acme-retrieval", slot: "retrieveUrl", toolExport: "readPage", envRequirements: [{options: [["ACME_RETRIEVAL_KEY"]]}] };
      return Response.json({name: definition.id, type: "registry:item", dependencies: ["ai", "zod"], meta: {chatjs: definition}, files: [
        {path: "chatjs.json", type: "registry:file", target: "~/tools/chatjs/acme-retrieval/chatjs.json", content: JSON.stringify(definition)},
        {path: "tool.ts", type: "registry:file", target: "~/tools/chatjs/acme-retrieval/tool.ts", content: `import {tool} from "ai";
import {z} from "zod";
export const readPage = tool({inputSchema: z.object({target: z.string()}), execute: async ({target}) => ({text: "Page content", source: target})});`},
      ]});
    }
    if (path === "/contracts.tgz") return new Response(Bun.file(archive));
		if (path === "/gateway.json")
			return Response.json({
				...external.root,
				dependencies: external.root.dependencies.map((d) =>
					d.startsWith("@chat-js/gateways@")
						? `@chat-js/gateways@http://127.0.0.1:${registryServer.port}/contracts.tgz`
						: d,
				),
				registryDependencies: [
					`http://127.0.0.1:${registryServer.port}/adapter.json`,
				],
			});
		if (path === "/adapter.json") return Response.json(external.adapter);
		if (path === "/v1/chat/completions") {
			if (request.headers.get("authorization") !== "Bearer fixture-key")
				return new Response("Unauthorized", { status: 401 });
			const body = await request.json();
			if (body.model !== "gpt-5-mini")
				return new Response("Wrong model", { status: 400 });
			return Response.json({
				id: "fixture-response",
				object: "chat.completion",
				created: 1,
				model: body.model,
				choices: [
					{
						index: 0,
						message: { role: "assistant", content: "External gateway works." },
						finish_reason: "stop",
					},
				],
				usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
			});
		}
		if (/^\/[a-z0-9-]+\.json$/.test(path)) {
			const file = Bun.file(
				join(cliDirectory, "../registry/dist/r", path.slice(1)),
			);
			if (await file.exists()) {
				const item = await file.json();
				if (item.dependencies)
					item.dependencies = item.dependencies.map((d: string) =>
						d.startsWith("@chat-js/gateways@")
							? `@chat-js/gateways@http://127.0.0.1:${registryServer.port}/contracts.tgz`
							: d,
					);
				return Response.json(item);
			}
		}
		return new Response("Not found", { status: 404 });
	},
});
afterAll(() => {
	registryServer.stop(true);
	if (originalRegistryUrl === undefined) delete process.env.CHATJS_REGISTRY_URL;
	else process.env.CHATJS_REGISTRY_URL = originalRegistryUrl;
});

for (const gateway of [...GATEWAYS, "acme"]) {
	it(`${gateway}: independently installed ChatJS app typechecks and loads the registry adapter`, async () => {
		const cwd = join(root, gateway);
		await run(root, [
			"node",
			cliEntry,
			"create",
			gateway,
			"--gateway",
			gateway === "acme"
				? `http://127.0.0.1:${registryServer.port}/gateway.json`
				: gateway,
      ...(gateway === "acme" ? ["--storage-provider", `http://127.0.0.1:${registryServer.port}/external-storage.json`, "--storage-config", '{"bucket":"test"}'] : gateway === "openai" ? ["--storage-provider", "s3", "--storage-config", '{"bucket":"test","region":"us-east-1"}'] : []),
			"--yes",
			"--no-electron",
 ...(gateway === "vercel" ? ["--image-generation-tool", "generate-image", "--search-tool", "firecrawl-search", "--code-execution-tool", "vercel-code-execution", "--url-retrieval-tool", "retrieve-url"] : gateway === "acme" ? ["--image-generation-tool", `http://127.0.0.1:${registryServer.port}/external-image.json`, "--url-retrieval-tool", `http://127.0.0.1:${registryServer.port}/external-retrieval.json`, "--code-execution-tool", `http://127.0.0.1:${registryServer.port}/external-execution.json`, "--search-tool", `http://127.0.0.1:${registryServer.port}/external-search.json`] : []),
		]);
		expect(await Bun.file(join(cwd, "tools/platform/generate-image.ts")).exists()).toBe(false);
    expect(await Bun.file(join(cwd, "components/part/generate-image.tsx")).exists()).toBe(false);
    if (gateway !== "vercel") {
      expect(await Bun.file(join(cwd, "tools/chatjs/generate-image/tool.ts")).exists()).toBe(false);
      expect(await readFile(join(cwd, "tools/chatjs/ui.ts"), "utf8")).not.toContain("generate-image/renderer");
    }
    if (gateway === "vercel" || gateway === "acme") {
      expect(await readFile(join(cwd, "chat.config.ts"), "utf8")).toMatch(/image:\s*{\s*enabled:\s*true/);
    }
    const manifestPath = join(cwd, "package.json");
		const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
 if (gateway === "vercel") {
 expect(manifest.dependencies["@vercel/sandbox"]).toBeDefined();
 expect(await Bun.file(join(cwd, "tools/chatjs/generate-image/tool.ts")).exists()).toBe(true);
 expect(await readFile(join(cwd, "tools/chatjs/ui.ts"), "utf8")).toContain("generate-image/renderer");
 expect(await readFile(join(cwd, "tools/chatjs/url-retrieval-config.ts"), "utf8")).toContain("FIRECRAWL_API_KEY");
 expect(await Bun.file(join(cwd, "tools/chatjs/retrieve-url/tool.ts")).exists()).toBe(true);
 expect(await readFile(join(cwd, "tools/chatjs/tools.ts"), "utf8")).toContain("vercel-code-execution/tool");
 expect(manifest.dependencies["@tavily/core"]).toBeUndefined();
 expect(await Bun.file(join(cwd, "tools/chatjs/tavily-search/tool.ts")).exists()).toBe(false);
 expect(await readFile(join(cwd, "tools/chatjs/tools.ts"), "utf8")).toContain("firecrawl-search/tool");
 expect(await readFile(join(cwd, "tools/chatjs/search-config.ts"), "utf8")).toContain("FIRECRAWL_API_KEY");
 }

		const selectedSdk =
			gateway === "acme"
				? "@ai-sdk/openai-compatible"
				: gatewayMetadata[gateway as keyof typeof gatewayMetadata].dependency;
		for (const { dependency } of Object.values(gatewayMetadata)) {
			if (dependency !== selectedSdk)
				expect(manifest.dependencies[dependency]).toBeUndefined();
		}
		// The shared npm archive must not carry any other adapter implementations.
		for (const name of GATEWAYS) {
			expect(
				await Bun.file(
					join(cwd, "node_modules/@chat-js/gateways/src", `${name}.ts`),
				).exists(),
			).toBe(false);
			expect(
				await Bun.file(
					join(cwd, "node_modules/@chat-js/gateways/dist", `${name}.js`),
				).exists(),
			).toBe(false);
		}

    if (gateway === "acme") {
      expect(manifest.dependencies["@vercel/sandbox"]).toBeUndefined();
      expect(await readFile(join(cwd, "tools/chatjs/image-generation-config.ts"), "utf8")).toContain("ACME_IMAGE_KEY");
      expect(manifest.dependencies["@tavily/core"]).toBeUndefined();
      expect(await Bun.file(join(cwd, "tools/platform/code-execution-contract.ts")).exists()).toBe(false);
      expect(await readFile(join(cwd, "tools/chatjs/ui.ts"), "utf8")).toContain("acme-execution/renderer");
      expect(await readFile(join(cwd, "tools/chatjs/ui.ts"), "utf8")).not.toContain("tool-webSearch");
      expect(await Bun.file(join(cwd, "tools/chatjs/vercel-code-execution/tool.ts")).exists()).toBe(false);
      expect(await readFile(join(cwd, "tools/chatjs/code-execution-config.ts"), "utf8")).toContain("ACME_EXECUTION_TOKEN");
      await writeFile(join(cwd, "verify-execution.ts"), `import assert from "node:assert/strict";
import {tools} from "./tools/chatjs/tools";
const tool = tools.codeExecution;
assert.ok(tool.execute);
const result = await tool.execute({command: "echo hello"}, {toolCallId: "fixture", messages: [], context: {}});
assert.deepEqual(result, {stdout: "echo hello", exitCode: 0});
assert.ok(tools.webSearch.execute);
const search = await tools.webSearch.execute({query: "independent schema"}, {toolCallId: "search", messages: [], context: {}});
assert.deepEqual(search, {documents: [{text: "independent schema", href: "https://example.com"}]});
assert.ok(tools.retrieveUrl.execute);
assert.ok(tools.generateImage.execute);
assert.deepEqual(await tools.generateImage.execute({subject: "mountains"}, {toolCallId: "image", messages: [], context: {}}), {asset: "mountains"});
const page = await tools.retrieveUrl.execute({target: "https://example.com"}, {toolCallId: "retrieve", messages: [], context: {}});
assert.deepEqual(page, {text: "Page content", source: "https://example.com"});
`);
      await run(cwd, ["bun", "verify-execution.ts"]);
      expect(manifest.dependencies["@mendable/firecrawl-js"]).toBeUndefined();
      expect(await Bun.file(join(cwd, "tools/chatjs/retrieve-url/tool.ts")).exists()).toBe(false);
      expect(await readFile(join(cwd, "tools/chatjs/url-retrieval-config.ts"), "utf8")).toContain("ACME_RETRIEVAL_KEY");
      expect(await readFile(join(cwd, "tools/chatjs/ui.ts"), "utf8")).not.toContain("tool-retrieveUrl");
      expect(manifest.dependencies["@vercel/blob"]).toBeUndefined();
      expect(manifest.dependencies["@aws-sdk/client-s3"]).toBeUndefined();
      await writeFile(join(cwd, "verify-storage.ts"), `import { Files } from "files-sdk";
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
`);
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
`,
		);
		if (gateway === "vercel") {
			await run(cwd, ["node", cliEntry, "add", "word-count", "--yes"]);
			const index = await readFile(join(cwd, "tools/chatjs/tools.ts"), "utf8");
			await run(cwd, ["node", cliEntry, "add", "word-count", "--yes"]);
			expect(await readFile(join(cwd, "tools/chatjs/tools.ts"), "utf8")).toBe(
				index,
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
				await readFile(join(cwd, "tools/chatjs/tools.ts"), "utf8"),
			).toContain("getWeather as tool");
		}
		await run(cwd, ["bun", "run", "test:types"]);
		await writeFile(
			join(cwd, "probe.ts"),
			`import { Gateway } from "./lib/ai/gateway";
import assert from "node:assert/strict";
assert.equal(new Gateway().type, "${gateway}");
`,
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
`,
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

`,
		);
		await run(cwd, ["bunx", "--no-install", "tsx", "probe-config.ts"]);
		if (gateway === "vercel") {
			for (const name of [
				"gateway-type-check.ts",
				"probe.ts",
				"probe-config.ts",
			])
				await rm(join(cwd, name));
			await run(cwd, ["bun", "run", "lint"]);
      const longDirectory = join(cwd, "tools/chatjs/long-renderer");
			await mkdir(longDirectory);
			const toolExport =
				"wordCountWithAnIntentionallyLongNameForFormattingVerification";
			const rendererExport =
				"WordCountRendererWithAnIntentionallyLongNameForFormattingVerification";
			await writeFile(
				join(longDirectory, "tool.ts"),
				`import { wordCount } from "../word-count/tool"; export const ${toolExport} = wordCount;`,
			);
			await writeFile(
				join(longDirectory, "renderer.tsx"),
				`import { WordCountRenderer } from "../word-count/renderer"; export const ${rendererExport} = WordCountRenderer;`,
			);
			await writeFile(
				join(longDirectory, "chatjs.json"),
				JSON.stringify({
					contractVersion: 1,
					kind: "tool",
					id: "long-renderer",
					toolExport,
					rendererExport,
				}),
			);
			await run(cwd, ["node", cliEntry, "sync"]);
			await run(cwd, ["bun", "run", "format"]);
			await run(cwd, ["node", cliEntry, "sync"]);
			await run(cwd, ["bun", "run", "lint"]);
		}
		expect(
			await Bun.file(
				join(cwd, "lib/ai/gateways/openrouter-gateway.ts"),
			).exists(),
		).toBe(false);
	}, 180_000);
}
