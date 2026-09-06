// Copy to the generated studio root and run with Bun.
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";

await rm(".author-bundle", { recursive: true, force: true });
const result = await Bun.build({
	entrypoints: ["./chat.client.ts"],
	outdir: "./.author-bundle",
	target: "browser",
	splitting: true,
});
assert(result.success, String(result.logs));
const files = await Promise.all(
	result.outputs.map(async (output) => ({
		path: output.path,
		kind: output.kind,
		bytes: output.size,
		text: await output.text(),
	})),
);
const entry = files.find((file) => file.kind === "entry-point");
assert(entry);
assert(!entry.text.includes("0 0 512 512"), "SVG renderer was eagerly bundled");
assert(
	!entry.text.includes("No search results."),
	"Search renderer was eagerly bundled",
);
assert(
	files.some(
		(file) => file.kind !== "entry-point" && file.text.includes("0 0 512 512"),
	),
);
assert(
	files.some(
		(file) =>
			file.kind !== "entry-point" && file.text.includes("No search results."),
	),
);
for (const file of files)
	for (const forbidden of [
		"AUTHOR_SEARCH_KEY",
		"AUTHOR_SEARCH_ENDPOINT",
		"AUTHOR_GATEWAY_KEY",
		"createOpenAI",
		"searchAuthorEndpoint",
	])
		assert(
			!file.text.includes(forbidden),
			`Server code in browser: ${forbidden}`,
		);
console.log(
	JSON.stringify(
		{
			clientServerIsolation: "passed",
			lazyRenderers: "passed",
			outputs: files.map(({ path, kind, bytes }) => ({
				path: path.split("/").pop(),
				kind,
				bytes,
			})),
		},
		null,
		2,
	),
);
