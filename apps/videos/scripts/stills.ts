/* oxlint-disable import/no-nodejs-modules -- the node:assert/strict import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import assert from "node:assert/strict";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable eslint/sort-imports -- the node:fs/promises import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
/* oxlint-disable import/no-nodejs-modules -- the node:fs/promises import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { mkdir, readFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable import/no-nodejs-modules -- the node:path import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable eslint/sort-imports -- the @remotion/bundler import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import { bundle } from "@remotion/bundler";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- the @remotion/renderer import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import { renderStill, selectComposition } from "@remotion/renderer";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/no-relative-parent-imports -- the ../webpack import: The source and its build/scaffold consumers share this relative module layout; replacing it needs an alias contract in every consumer. */
import { webpackOverride } from "../webpack";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable node/no-top-level-await -- serveUrl: The Bun render command must finish setup before scheduling captures. */
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.tsx"),
  webpackOverride,
});
/* oxlint-enable node/no-top-level-await */
/* oxlint-disable node/no-top-level-await -- composition: The Bun render command must finish setup before scheduling captures. */
const composition = await selectComposition({ id: "ThreadsLaunch", serveUrl });
/* oxlint-enable node/no-top-level-await */
/* oxlint-disable node/no-top-level-await -- stills.ts: The Bun render command must finish setup before scheduling captures. */
await mkdir("out/stills", { recursive: true });
/* oxlint-enable node/no-top-level-await */
// One representative capture per meaningful state, plus an out-of-order seek.
const seen = new Set<number>();
/* oxlint-disable eslint/no-magic-numbers -- stills.ts: Frame offsets, normalized coordinates and animation constants specify this scene's timing and geometry. */
/* oxlint-disable eslint/no-ternary -- stills.ts: The expression preserves the existing fallback/derived-value contract within this operation. */
/* oxlint-disable node/no-top-level-await -- stills.ts: The Bun render command must finish setup before scheduling captures. */
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
/* oxlint-enable node/no-top-level-await */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/no-magic-numbers */
