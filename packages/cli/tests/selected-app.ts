import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { minimalSelection } from "../src/selection/schema";

const root = await mkdtemp(join(tmpdir(), "chatjs-selected-"));
const app = join(root, "app");
const cli = resolve(import.meta.dir, "../dist/index.js");
const file = (path: string, content: string) => ({
	path,
	type: "registry:file",
	target: `~/${path}`,
	content,
});
const items: Record<string, unknown> = {
	identity: {
		name: "identity",
		type: "registry:item",
		dependencies: ["jose@6.2.3"],
		files: [
			file(
				"lib/identity.ts",
				`${await readFile(new URL("../../../examples/minimal-next/lib/identity.ts", import.meta.url), "utf8")}\nexport const identityVariant = "external";\n`,
			),
		],
		meta: { chatjs: { provides: ["identity"] } },
	},
	"broken-identity": {
		name: "broken-identity",
		type: "registry:item",
		files: [file("lib/identity.ts", "export const broken = true;\n")],
		meta: { chatjs: { provides: ["identity"] } },
	},
	weather: {
		name: "weather",
		type: "registry:item",
		files: [
			file(
				"agent/tools/weather.ts",
				'import {defineTool} from "eve/tools";\nimport {input, type Output} from "../../tools/weather/contract";\nexport default defineTool({description:"Return fixture weather for a city.",inputSchema:input,execute:async({city}):Promise<Output>=>({city,celsius:20})});\n',
			),
			file(
				"tools/weather/contract.ts",
				'import {z} from "zod";\nexport const input=z.object({city:z.string()});\nexport const output=z.object({city:z.string(),celsius:z.number()});\nexport type Output=z.infer<typeof output>;\n',
			),
			file(
				"tools/weather/client.tsx",
				'import {output} from "./contract";\nimport {toolRenderer} from "../../lib/tool-renderer";\nexport const Weather = toolRenderer(output,()=>import("./renderer"));\n',
			),
			file(
				"tools/weather/renderer.tsx",
				'import type {Output} from "./contract";\nexport default function Weather({output}:{output:Output}) {return <p>Weather in {output.city}: {output.celsius}°C</p>}\n',
			),
		],
		meta: {
			chatjs: {
				requires: ["eve"],
				renderers: [
					{
						mount: "weather",
						path: "./tools/weather/client",
						export: "Weather",
					},
				],
			},
		},
	},
	banner: {
		name: "banner",
		type: "registry:item",
		dependencies: ["clsx@2.1.1"],
		files: [
			file(
				"components/external/banner.tsx",
				'import {clsx} from "clsx";\nexport function Banner(){return <aside className={clsx("external-banner")}>External frontend installed</aside>}\n',
			),
		],
		meta: {
			chatjs: {
				components: [
					{ path: "./components/external/banner", export: "Banner" },
				],
			},
		},
	},
	layout: {
		name: "layout",
		type: "registry:item",
		files: [
			file(
				"components/external/layout.tsx",
				'import type {ReactNode} from "react";\nexport default function Layout({children}:{children:ReactNode}){return <div data-layout="external"><h1>External layout</h1>{children}</div>}\n',
			),
		],
		meta: {
			chatjs: {
				provides: ["layout"],
				layout: { path: "./components/external/layout", export: "default" },
			},
		},
	},
};
const server = createServer((request, response) => {
	response.setHeader("content-type", "application/json");
	response.end(JSON.stringify(items[(request.url ?? "").slice(1)]));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const bound = server.address();
assert(bound && typeof bound !== "string");
const origin = `http://127.0.0.1:${bound.port}`;
async function command(args: string[], cwd = root, env = process.env) {
	const child = Bun.spawn(args, { cwd, env, stdout: "pipe", stderr: "pipe" });
	const [code, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	assert.equal(code, 0, `${args.join(" ")}\n${stdout}\n${stderr}`);
	return stdout;
}
async function compiledToolNames() {
	// Eve evaluates channel modules during compilation. PostgreSQL's client is
	// lazy; this unreachable placeholder provides configuration without services.
	await command(["node", "node_modules/eve/bin/eve.js", "build"], app, {
		...process.env,
		APP_DATABASE_URL: "postgres://fixture:fixture@127.0.0.1:1/unused",
	});
	return (await Bun.file(join(app, ".eve/agent-summary.json")).json()).tools
		.map((tool: { name: string }) => tool.name)
		.sort();
}
try {
	const selection = join(root, "selection.json");
	await writeFile(selection, JSON.stringify(minimalSelection));
	await command([
		"node",
		cli,
		"create",
		app,
		"--selection",
		selection,
		"--yes",
	]);
	assert(!(await Bun.file(join(app, "agent/tools/confirm_note.ts")).exists()));
	assert(!(await Bun.file(join(app, "lib/note-contract.ts")).exists()));
	const minimal = JSON.parse(await readFile(join(app, "package.json"), "utf8"));
	assert.deepEqual(await compiledToolNames(), []);
	for (const omitted of [
		"@ai-sdk/openai-compatible",
		"clsx",
		"papaparse",
		"files-sdk",
		"@vercel/sandbox",
		"@upstash/redis",
	])
		assert(!minimal.dependencies[omitted]);
	await writeFile(
		join(app, "renderer-contract.tsx"),
		`import {z} from "zod";
import {toolRenderer} from "./lib/tool-renderer";
const output=z.object({celsius:z.number()});
// A renderer cannot silently invent a different output shape.
// @ts-expect-error renderer output disagrees with the shared schema
toolRenderer(output,async()=>({default:({output}:{output:{celsius:string}})=><p>{output.celsius}</p>}));
`,
	);
	await command(["bun", "run", "test:types"], app);
	await rm(join(app, "renderer-contract.tsx"));
	await writeFile(
		join(app, "renderer-boundary.tsx"),
		`import assert from "node:assert/strict";
import {renderToString} from "react-dom/server";
import {z} from "zod";
import {toolRenderer} from "./lib/tool-renderer";
import {ToolResults} from "./components/chat/tool-results";
let loaded=false;
const Renderer=toolRenderer(z.object({celsius:z.number()}),async()=>{loaded=true;return {default:({output}:{output:{celsius:number}})=><p>{output.celsius}</p>};});
assert.match(renderToString(<Renderer value={{celsius:"invalid"}}/>),/Tool result unavailable/);
assert.equal(loaded,false);
assert.match(renderToString(<ToolResults parts={[{type:"dynamic-tool",toolCallId:"unknown",toolName:"__proto__",state:"output-available",input:{},output:{}}]}/>),/__proto__/);
`,
	);
	await command(["bun", "renderer-boundary.tsx"], app);
	await rm(join(app, "renderer-boundary.tsx"));
	await writeFile(
		join(app, "chat.client.ts"),
		(await readFile(join(app, "chat.client.ts"), "utf8")) +
			"// owner customization\n",
	);
	const before = await readFile(join(app, "chat.client.ts"), "utf8");
	await command([
		"node",
		cli,
		"add",
		`${origin}/weather`,
		`${origin}/banner`,
		"@chatjs/confirm-note",
		"--cwd",
		app,
		"--yes",
	]);
	assert.equal(await readFile(join(app, "chat.client.ts"), "utf8"), before);
	assert(await Bun.file(join(app, "agent/tools/weather.ts")).exists());
	assert(await Bun.file(join(app, "tools/weather/renderer.tsx")).exists());
	assert(await Bun.file(join(app, "components/external/banner.tsx")).exists());
	const updated = JSON.parse(await readFile(join(app, "package.json"), "utf8"));
	assert.equal(updated.dependencies.clsx, "2.1.1");
	for (const path of [
		"chat.client.ts",
		"chat.selection.json",
		"chat.installation.json",
	])
		await cp(join(app, ".chatjs/proposals", path), join(app, path));
	await command(["bun", "run", "test:types"], app);
	const selected = JSON.parse(
		await readFile(join(app, "chat.selection.json"), "utf8"),
	);
	const originalSelection = structuredClone(selected);
	selected.items = selected.items
		.filter((item: string) => item !== "@chatjs/layout-minimal")
		.concat(`${origin}/layout`);
	await writeFile(selection, JSON.stringify(selected));
	const layout = join(app, "components/chat/app-layout.tsx");
	await command([
		"node",
		cli,
		"add",
		"--selection",
		selection,
		"--cwd",
		app,
		"--yes",
	]);
	assert(
		await Bun.file(
			join(app, ".chatjs/proposals/components/chat/app-layout.tsx"),
		).exists(),
	);
	// Abandon B and request original A: old proposals must not survive.
	await writeFile(selection, JSON.stringify(originalSelection));
	await command([
		"node",
		cli,
		"add",
		"--selection",
		selection,
		"--cwd",
		app,
		"--yes",
	]);
	assert(
		!(await Bun.file(
			join(app, ".chatjs/proposals/components/chat/app-layout.tsx"),
		).exists()),
	);
	await writeFile(selection, JSON.stringify(selected));
	await writeFile(
		layout,
		`${await readFile(layout, "utf8")}// retain layout edit\n`,
	);
	const oldLayout = await readFile(layout, "utf8");
	await command([
		"node",
		cli,
		"add",
		"--selection",
		selection,
		"--cwd",
		app,
		"--yes",
	]);
	assert.equal(await readFile(layout, "utf8"), oldLayout);
	assert(
		(
			await readFile(
				join(app, ".chatjs/proposals/components/chat/app-layout.tsx"),
				"utf8",
			)
		).includes("external/layout"),
	);
	await cp(
		join(app, ".chatjs/proposals/components/chat/app-layout.tsx"),
		layout,
	);
	await cp(
		join(app, ".chatjs/proposals/chat.selection.json"),
		join(app, "chat.selection.json"),
	);
	await cp(
		join(app, ".chatjs/proposals/chat.installation.json"),
		join(app, "chat.installation.json"),
	);
	const identity = join(app, "lib/identity.ts");
	await writeFile(
		identity,
		`${await readFile(identity, "utf8")}\n// custom host identity edit\n`,
	);
	const originalIdentity = await readFile(identity, "utf8");
	const identitySelection = {
		...selected,
		items: selected.items
			.filter((item: string) => item !== "@chatjs/host-identity")
			.concat(`${origin}/broken-identity`),
	};
	await writeFile(selection, JSON.stringify(identitySelection));
	await assert.rejects(
		command([
			"node",
			cli,
			"add",
			"--selection",
			selection,
			"--cwd",
			app,
			"--yes",
		]),
		/has no exported member/,
	);
	assert.equal(await readFile(identity, "utf8"), originalIdentity);
	identitySelection.items = identitySelection.items
		.filter((item: string) => item !== `${origin}/broken-identity`)
		.concat(`${origin}/identity`);
	await writeFile(selection, JSON.stringify(identitySelection));
	await command([
		"node",
		cli,
		"add",
		"--selection",
		selection,
		"--cwd",
		app,
		"--yes",
	]);
	assert.equal(await readFile(identity, "utf8"), originalIdentity);
	assert(
		(
			await readFile(join(app, ".chatjs/proposals/lib/identity.ts"), "utf8")
		).includes('identityVariant = "external"'),
	);
	for (const path of [
		"lib/identity.ts",
		"chat.selection.json",
		"chat.installation.json",
	])
		await cp(join(app, ".chatjs/proposals", path), join(app, path));
	await command(["bun", "run", "test:types"], app);
	assert.deepEqual(await compiledToolNames(), ["confirm_note", "weather"]);
	console.log(
		JSON.stringify(
			{
				app,
				checks: [
					"minimal actual CLI creation and typecheck",
					"unselected tool/source/dependencies absent",
					"compiled Eve toolsets match minimal and expanded selections",
					"external paired tool and frontend-only installed",
					"edited composition preserved and proposed composition typechecked",
					"external layout proposal preserved edits",
					"stale proposals removed after abandoned layout change",
					"same-path external identity source proposed and typechecked",
					"broken identity source rejected despite existing valid implementation",
					"renderer type mismatch rejected and malformed/unknown output falls back",
					"adopted app typechecks",
				],
				minimalDependencies: minimal.dependencies,
			},
			null,
			2,
		),
	);
} finally {
	server.close();
	if (process.env.M08_KEEP_GENERATED !== "1")
		await rm(root, { recursive: true, force: true });
}
