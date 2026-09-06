import { afterAll, describe, expect, test } from "bun:test";
import { createServer } from "node:http";
import { inspectSelection, targetPath, withRegistry } from "./registry";
import { metadataSchema, minimalSelection, selectionSchema } from "./schema";

const file = {
	path: "x.ts",
	target: "~/x.ts",
	type: "registry:file",
	content: "export {};",
};
const items: Record<string, unknown> = {
	missing: {
		name: "missing",
		type: "registry:item",
		meta: { chatjs: { requires: ["files.write"] } },
	},
	conflict: {
		name: "conflict",
		type: "registry:item",
		meta: { chatjs: { provides: ["model"] } },
	},
	collision: {
		name: "collision",
		type: "registry:item",
		files: [{ ...file, target: "~/lib/env.ts" }],
	},
	escape: {
		name: "escape",
		type: "registry:item",
		files: [{ ...file, target: "~/../outside.ts" }],
	},
	composition: {
		name: "composition",
		type: "registry:item",
		files: [{ ...file, target: "~/chat.client.ts" }],
	},
	deps: { name: "deps", type: "registry:item", dependencies: ["react@18.0.0"] },
};
const server = createServer((request, response) => {
	response.setHeader("content-type", "application/json");
	response.end(JSON.stringify(items[(request.url ?? "").slice(1)]));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const bound = server.address();
if (!bound || typeof bound === "string") throw Error("listener unavailable");
const origin = `http://127.0.0.1:${bound.port}`;
afterAll(() => server.close());

describe("shared selection preflight", () => {
	test("accepts the real minimal graph without optional tool implementations", async () => {
		await withRegistry(minimalSelection, async (config) => {
			const result = await inspectSelection(minimalSelection, config);
			expect(
				result.tree.files?.some(
					(file) => file.target === "~/agent/tools/confirm_note.ts",
				),
			).toBe(false);
			expect(result.tree.dependencies).not.toContain(
				"@ai-sdk/openai-compatible@3.0.44",
			);
		});
	});
	for (const [name, error] of [
		["missing", "Missing required integration"],
		["conflict", "Conflicting implementations"],
		["collision", "Conflicting registry target"],
		["escape", "Unsafe registry target"],
		["composition", "cannot replace developer composition"],
		["deps", "Conflicting exact dependency"],
	]) {
		test(`rejects ${name} before installation`, async () => {
			const selection = {
				...minimalSelection,
				items: [...minimalSelection.items, `${origin}/${name}`],
			};
			await expect(
				withRegistry(selection, (config) =>
					inspectSelection(selection, config),
				),
			).rejects.toThrow(error);
		});
	}
	test("share data excludes arbitrary runtime/secret fields and expressions", () => {
		expect(() =>
			selectionSchema.parse({ ...minimalSelection, secret: "private" }),
		).toThrow();
		expect(() =>
			metadataSchema.parse({
				model: { path: "./../../secret", export: "default" },
			}),
		).toThrow();
		expect(() =>
			metadataSchema.parse({ model: { path: "./model", export: "run()" } }),
		).toThrow();
		expect(() => targetPath("~/../../escape")).toThrow();
		expect(
			selectionSchema.parse(JSON.parse(JSON.stringify(minimalSelection))),
		).toEqual(minimalSelection);
	});
});
