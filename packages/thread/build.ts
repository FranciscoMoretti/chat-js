const result = await Bun.build({
	entrypoints: [
		`${import.meta.dir}/src/index.ts`,
		`${import.meta.dir}/src/react.ts`,
	],
	format: "esm",
	outdir: `${import.meta.dir}/dist`,
	packages: "external",
	splitting: true,
	target: "browser",
});

if (!result.success) {
	for (const log of result.logs) console.error(log);
	throw new Error("Failed to build @chatjs/thread");
}

const reactPath = `${import.meta.dir}/dist/react.js`;
const reactSource = await Bun.file(reactPath).text();
const clientDirective = `"use client";`;
await Bun.write(
	reactPath,
	`${clientDirective}\n${reactSource.replaceAll(clientDirective, "")}`,
);
