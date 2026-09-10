import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";
import { registry } from "../registry";

// The reference app intentionally uses the uncustomized published source.
// A deliberate customization should be recorded here with its reason.
const referenceItems = new Set([
	"vercel-gateway",
	"word-count",
	"get-weather",
	"retrieve-url",
	"toolkit-renderer",
]);
const packageRoot = resolve(import.meta.dir, "..");
function emitted(source: string, fileName: string) {
	return ts
		.transpileModule(source, {
			fileName,
			compilerOptions: {
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ESNext,
				jsx: ts.JsxEmit.Preserve,
				removeComments: true,
			},
		})
		.outputText.trim();
}

test("reference consumer stays aligned with canonical registry source", async () => {
	for (const item of registry.items.filter((item) =>
		referenceItems.has(item.name),
	)) {
		for (const file of item.files ?? []) {
			if (!file.target)
				throw new Error("Reference files need explicit targets");
			const source = await readFile(resolve(packageRoot, file.path), "utf8");
			const installed = await readFile(
				resolve(
					packageRoot,
					"../../apps/chat",
					file.target.replace(/^~\//, ""),
				),
				"utf8",
			);
			expect(emitted(installed, file.path)).toBe(emitted(source, file.path));
		}
	}
});
