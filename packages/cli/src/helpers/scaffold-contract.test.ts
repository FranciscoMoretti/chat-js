import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectEnvChecklist } from "./env-checklist";
import { buildConfigTs } from "./config-builder";
import { GATEWAYS, type BuiltInToolKey, type Gateway } from "../types";

const localRegistryUrl = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../registry/items/{name}.json",
);

const tempDirs: string[] = [];

async function makeTempDir(name: string): Promise<string> {
	const dir = join(
		tmpdir(),
		`chat-js-scaffold-contract-${name}-${crypto.randomUUID()}`,
	);
	tempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	await Promise.all(
		tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

function buildConfigFor(
	gateway: Gateway,
	builtInTools: Record<BuiltInToolKey, boolean>,
) {
	return buildConfigTs({
		appName: "Contract Test",
		appPrefix: "contract-test",
		appUrl: "http://localhost:3000",
		withElectron: false,
		gateway,
		coreFeatures: {
			attachments: true,
			parallelResponses: true,
			documents: true,
			mcp: true,
			followupSuggestions: true,
		},
		documentTypes: {
			text: true,
			code: true,
			sheet: true,
		},
		builtInTools,
		auth: {
			google: true,
			github: true,
			vercel: true,
		},
	});
}

describe("scaffold contracts", () => {
	it("builds valid configs for the high-risk built-in tool matrix", () => {
		const allBuiltIns = {
			webSearch: true,
			urlRetrieval: true,
			deepResearch: true,
			codeExecution: true,
			imageGeneration: true,
			videoGeneration: true,
		} satisfies Record<BuiltInToolKey, boolean>;

		for (const gateway of GATEWAYS) {
			const output = buildConfigFor(gateway, allBuiltIns);
			expect(output).toContain(`gateway: ${JSON.stringify(gateway)}`);
		}

		const openaiCompatible = buildConfigFor("openai-compatible", allBuiltIns);
		expect(openaiCompatible).toContain('default: "gpt-image-1"');
		expect(openaiCompatible).toMatch(/video:\s*{\s*enabled:\s*false,/m);

		const litellm = buildConfigFor("litellm", allBuiltIns);
		expect(litellm).toContain('chat: "openai/gpt-4o-mini"');
		expect(litellm).toMatch(/image:\s*{\s*enabled:\s*false,/m);
		expect(litellm).toMatch(/video:\s*{\s*enabled:\s*false,/m);
	});
});
