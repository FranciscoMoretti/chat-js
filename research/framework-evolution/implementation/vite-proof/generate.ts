import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { minimalSelection } from "../../../../packages/cli/src/selection/schema";

const target = process.argv[2];
if (!target)
	throw Error(
		"Pass a new empty output directory; this script recreates the pre-adaptation Next app.",
	);
const root = resolve(import.meta.dir, "../../../..");
const registry = JSON.parse(
	await readFile(`${root}/packages/cli/registry/confirm-note.json`, "utf8"),
);
registry.name = "portable-confirm-note";
const server = createServer((_req, res) => {
	res.setHeader("content-type", "application/json");
	res.end(JSON.stringify(registry));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw Error("No registry address");
const selection = {
	...minimalSelection,
	items: [
		...minimalSelection.items,
		`http://127.0.0.1:${address.port}/confirm-note.json`,
	],
};
await writeFile(
	`${import.meta.dir}/selection.json`,
	JSON.stringify(selection, null, 2),
);
try {
	const child = Bun.spawn(
		[
			"node",
			`${root}/packages/cli/dist/index.js`,
			"create",
			resolve(target),
			"--selection",
			`${import.meta.dir}/selection.json`,
			"--yes",
		],
		{ stdout: "inherit", stderr: "inherit" },
	);
	if (await child.exited) throw Error("Generation failed");
} finally {
	server.close();
}
