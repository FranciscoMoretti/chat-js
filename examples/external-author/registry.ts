import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Ordinary universal shadcn payloads. This author server does not resolve or
// install dependencies; the pinned ChatJS CLI delegates that to shadcn.
async function filesUnder(directory: string) {
	const root = join(import.meta.dir, directory);
	const paths = (await readdir(root, { recursive: true })).filter((path) =>
		/\.(ts|tsx)$/.test(path),
	);
	return Promise.all(
		paths.map(async (path) => ({
			path,
			type: "registry:file",
			target: `~/${path}`,
			content: await readFile(join(root, path), "utf8"),
		})),
	);
}
function item(
	name: string,
	files: unknown[],
	extra: Record<string, unknown> = {},
) {
	return {
		$schema: "https://ui.shadcn.com/schema/registry-item.json",
		name,
		type: "registry:item",
		files,
		...extra,
	};
}
export async function authorItems() {
	const sources = await filesUnder("registry-source");
	const frontend = (await filesUnder("frontend-source")).map((file) => ({
		...file,
		target: `~/components/author/${file.path}`,
	}));
	const svg = sources.filter((file) => /svg/.test(file.path));
	const search = sources.filter((file) => /search/.test(file.path));
	return {
		gateway: item(
			"author-gateway",
			[
				{
					path: "gateway.ts",
					type: "registry:file",
					target: "~/integrations/author/gateway.ts",
					content: await readFile(
						join(import.meta.dir, "model-source/gateway.ts"),
						"utf8",
					),
				},
			],
			{
				dependencies: ["@ai-sdk/openai@4.0.59"],
				envVars: {
					AUTHOR_GATEWAY_URL: "https://api.openai.com/v1",
					AUTHOR_GATEWAY_KEY: "",
				},
				docs: "Configure this server-side compatible endpoint and key. The current base agent requires a catalog-known model ID; fixed model metadata is not yet an independent selection field.",
				meta: {
					chatjs: {
						provides: ["model"],
						model: {
							path: "./integrations/author/gateway",
							export: "createModel",
						},
					},
				},
			},
		),
		"compatible-negative": item(
			"author-compatible-negative",
			[
				{
					path: "compatible-gateway.ts",
					type: "registry:file",
					target: "~/integrations/author/gateway.ts",
					content: await readFile(
						join(import.meta.dir, "model-source/compatible-gateway.ts"),
						"utf8",
					),
				},
			],
			{
				dependencies: ["@ai-sdk/openai-compatible@3.0.44"],
				meta: {
					chatjs: {
						provides: ["model"],
						model: {
							path: "./integrations/author/gateway",
							export: "createModel",
						},
					},
				},
				docs: "Negative conformance example: compilation lacks context metadata for the unlisted provider identity. Do not advertise as ready to execute.",
			},
		),
		svg: item("author-svg", svg, {
			dependencies: ["zod@4.3.6"],
			meta: {
				chatjs: {
					requires: ["eve"],
					renderers: [
						{
							mount: "draw_svg",
							path: "./components/author-svg/client",
							export: "SvgResult",
						},
					],
				},
			},
		}),
		search: item("author-search", search, {
			dependencies: ["zod@4.3.6"],
			envVars: { AUTHOR_SEARCH_ENDPOINT: "", AUTHOR_SEARCH_KEY: "" },
			docs: "Configure the HTTP search service described in TOOLS.md. This is an alternative whole tool, not an adapter for a P2 research service.",
			meta: {
				chatjs: {
					requires: ["eve"],
					renderers: [
						{
							mount: "author_search",
							path: "./components/author-search/client",
							export: "SearchResult",
						},
					],
				},
			},
		}),
		scratchpad: item(
			"author-scratchpad",
			frontend.filter((file) => file.path === "scratchpad.tsx"),
			{
				meta: {
					chatjs: {
						components: [
							{ path: "./components/author/scratchpad", export: "Scratchpad" },
						],
					},
				},
			},
		),
		layout: item(
			"author-layout",
			frontend.filter((file) => file.path === "studio-layout.tsx"),
			{
				meta: {
					chatjs: {
						provides: ["layout"],
						layout: {
							path: "./components/author/studio-layout",
							export: "StudioLayout",
						},
					},
				},
			},
		),
	};
}
