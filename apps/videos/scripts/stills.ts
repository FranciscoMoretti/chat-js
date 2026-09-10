import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

import { webpackOverride } from "../webpack";

const serveUrl = await bundle({
	entryPoint: resolve("src/index.tsx"),
	webpackOverride,
});
const composition = await selectComposition({ serveUrl, id: "ThreadsLaunch" });
await mkdir("out/stills", { recursive: true });
// One representative capture per meaningful state, plus an out-of-order seek.
const seen = new Set<number>();
for (const second of [
	0, 7, 8.5, 9.9, 15, 16.9, 17.2, 18.5, 20, 20.3, 25, 28.9, 31, 34, 35, 36.5,
	36.7, 37, 38, 39, 40, 42.5, 45, 7,
]) {
	const output = `out/stills/${second}${seen.has(second) ? "-seek" : ""}.png`;
	await renderStill({
		serveUrl,
		composition,
		frame: Math.round(second * composition.fps),
		output,
	});
	if (seen.has(second)) {
		assert.deepEqual(
			await readFile(output),
			await readFile(`out/stills/${second}.png`),
			"Out-of-order renders must be identical",
		);
	}
	seen.add(second);
	console.log(`Rendered ${second}s`);
}
