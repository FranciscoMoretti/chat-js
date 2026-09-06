import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { metadataSchema, selectionSchema } from "./src/selection/schema";

const source = new URL("../../examples/minimal-next/", import.meta.url);
const output = new URL("./registry/", import.meta.url);
await mkdir(output, { recursive: true });
for (const [name, schema] of [
	["selection-schema", selectionSchema],
	["metadata-schema", metadataSchema],
] as const)
	await writeFile(
		new URL(`${name}.json`, output),
		`${JSON.stringify(z.toJSONSchema(schema), null, 2)}\n`,
	);
const manifest = JSON.parse(
	await readFile(new URL("package.json", source), "utf8"),
);
const all = (await readdir(source, { recursive: true })).filter(
	(path) =>
		!path
			.split("/")
			.some((part) => part.startsWith(".") || part === "node_modules") &&
		/\.(ts|tsx|css|md|json)$/.test(path),
);
const groups: Record<string, string[]> = {
	openai: ["integrations/model.ts"],
	"host-identity": ["lib/identity.ts"],
	postgres: ["lib/bindings.ts", "scripts/db-init.ts", "agent/agent.ts"],
	"layout-minimal": ["components/chat/layout-minimal.tsx"],
	"confirm-note": [
		"agent/tools/confirm_note.ts",
		"lib/note-contract.ts",
		"components/confirm-note/client.tsx",
		"components/confirm-note/renderer.tsx",
	],
};
const separate = new Set(Object.values(groups).flat());
groups["minimal-next"] = all.filter(
	(path) =>
		!separate.has(path) &&
		(path.startsWith("app/") ||
			path.startsWith("lib/") ||
			path.startsWith("agent/") ||
			path === "components/chat/tool-results.tsx" ||
			["tsconfig.json", "next.config.ts"].includes(path)),
);
const special = new Set([
	"@ai-sdk/openai",
	"postgres",
	"@workflow/world-postgres",
	"jose",
]);
const definitions = {
	"minimal-next": {
		dependencies: Object.entries(manifest.dependencies)
			.filter(([name]) => !special.has(name))
			.map(([name, v]) => `${name}@${v}`),
		devDependencies: Object.entries(manifest.devDependencies).map(
			([name, v]) => `${name}@${v}`,
		),
		meta: {
			chatjs: {
				provides: ["node", "next", "eve"],
				requires: ["model", "identity", "execution", "bindings", "layout"],
			},
		},
		envVars: {
			APP_ORIGIN: "http://localhost:3000",
			EVE_INTERNAL_ORIGIN: "http://localhost:3001",
			EVE_GATEWAY_SECRET: "",
		},
	},
	openai: {
		dependencies: [`@ai-sdk/openai@${manifest.dependencies["@ai-sdk/openai"]}`],
		meta: {
			chatjs: {
				provides: ["model"],
				model: { path: "./integrations/model", export: "createModel" },
			},
		},
		envVars: { OPENAI_API_KEY: "" },
	},
	"host-identity": {
		dependencies: [`jose@${manifest.dependencies.jose}`],
		meta: { chatjs: { provides: ["identity"] } },
		envVars: { APP_IDENTITY_SECRET: "" },
	},
	postgres: {
		dependencies: [
			`postgres@${manifest.dependencies.postgres}`,
			`@workflow/world-postgres@${manifest.dependencies["@workflow/world-postgres"]}`,
		],
		meta: {
			chatjs: {
				provides: ["execution", "bindings"],
				requires: ["node", "eve"],
			},
		},
		envVars: {
			APP_DATABASE_URL: "",
			WORKFLOW_POSTGRES_URL: "",
			WORKFLOW_TARGET_WORLD: "@workflow/world-postgres",
		},
		docs: "Use PostgreSQL. Run bun run db:init, then node --env-file=.env.local node_modules/@workflow/world-postgres/bin/setup.js. Eve runs on Node 24+. Keep the worker listener private.",
	},
	"layout-minimal": {
		meta: {
			chatjs: {
				provides: ["layout"],
				layout: { path: "./components/chat/layout-minimal", export: "default" },
			},
		},
	},
	"confirm-note": {
		meta: {
			chatjs: {
				requires: ["eve"],
				renderers: [
					{
						mount: "confirm_note",
						path: "./components/confirm-note/client",
						export: "ConfirmNote",
					},
				],
			},
		},
	},
};
for (const [name, paths] of Object.entries(groups)) {
	const files = await Promise.all(
		paths.map(async (path) => ({
			path,
			type: "registry:file",
			target: `~/${path}`,
			content:
				path === "agent/instructions.md"
					? "You are a concise assistant. Use available tools when requested. Never claim approval before it is granted.\n"
					: await readFile(new URL(path, source), "utf8"),
		})),
	);
	await writeFile(
		new URL(`${name}.json`, output),
		`${JSON.stringify(
			{
				$schema: "https://ui.shadcn.com/schema/registry-item.json",
				name,
				type: "registry:item",
				files,
				...definitions[name as keyof typeof definitions],
			},
			null,
			2,
		)}\n`,
	);
}
console.log("Built selected minimal Next registry items from M07 source.");
