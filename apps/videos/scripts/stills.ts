/* oxlint-disable import/no-nodejs-modules -- the node:assert/strict import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import assert from "node:assert/strict";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:fs/promises import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { mkdir, readFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:path import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

/* oxlint-disable import/no-relative-parent-imports -- the ../webpack import: The source and its build/scaffold consumers share this relative module layout; replacing it needs an alias contract in every consumer. */
import { webpackOverride } from "../webpack";
/* oxlint-enable import/no-relative-parent-imports */

const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.tsx"),
  webpackOverride,
});
const composition = await selectComposition({ id: "ThreadsLaunch", serveUrl });
await mkdir("out/stills", { recursive: true });
// One representative capture per meaningful state, plus an out-of-order seek.
const seen = new Set<number>();
/* oxlint-disable eslint/no-magic-numbers -- stills.ts: Frame offsets, normalized coordinates and animation constants specify this scene's timing and geometry. */
/* oxlint-disable eslint/no-console -- stills.ts: This command or desktop boundary reports startup, progress and failures to its operator. */
for (const second of [
  0, 7, 8.5, 9.9, 15, 16.9, 17.2, 18.5, 20, 20.3, 25, 28.9, 31, 34, 35, 36.5,
  36.7, 37, 38, 39, 40, 42.5, 45, 7,
]) {
  const output = `out/stills/${second}${seen.has(second) ? "-seek" : ""}.png`;
  // oxlint-disable-next-line no-await-in-loop -- Preserve seek order and avoid concurrent browser renderers consuming unbounded memory.
  await renderStill({
    composition,
    frame: Math.round(second * composition.fps),
    output,
    serveUrl,
  });
  if (seen.has(second)) {
    // oxlint-disable-next-line no-await-in-loop -- Compare the repeated frame only after this sequential render has completed.
    const [actual, expected] = await Promise.all([
      readFile(output),
      readFile(`out/stills/${second}.png`),
    ]);
    assert.deepEqual(
      actual,
      expected,
      "Out-of-order renders must be identical"
    );
  }
  seen.add(second);
  console.log(`Rendered ${second}s`);
}
/* oxlint-enable eslint/no-console */
/* oxlint-enable eslint/no-magic-numbers */
