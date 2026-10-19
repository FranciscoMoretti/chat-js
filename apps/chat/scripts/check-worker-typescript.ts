import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Run after eve:build. Exercise the emitted PostgreSQL/Graphile/cosmiconfig
// loader, since importing the source dependency would miss bundler regressions.
const server = path.resolve(".output/server");
const files = await readdir(server, { recursive: true });
const chunks = await Promise.all(
  files
    .filter((file) => file.endsWith(".mjs") && !file.includes("node_modules/"))
    .map(async (file) => ({
      file,
      source: await readFile(path.join(server, file), "utf-8"),
    }))
);
const worldChunks: string[] = [];
for (const { file, source } of chunks) {
  assert.ok(
    !source.includes("function createSourceFile("),
    `TypeScript compiler is still bundled in ${file}`
  );
  if (source.includes('cosmiconfigSync)("graphile-worker")')) {
    worldChunks.push(file);
  }
}
assert.equal(
  worldChunks.length,
  1,
  "Expected one bundled Graphile config loader"
);
const [worldChunk] = worldChunks;
assert.ok(worldChunk);
const worldUrl = pathToFileURL(path.join(server, worldChunk)).href;
const directory = await mkdtemp(
  path.join(tmpdir(), "chatjs-worker-typescript-")
);
const probe = `
  import assert from 'node:assert/strict';
  import { createRequire } from 'node:module';
  import { realpathSync } from 'node:fs';
  import path from 'node:path';
  const require = createRequire(${JSON.stringify(path.join(server, "index.mjs"))});
  const compiler = require.resolve('typescript');
  assert(realpathSync(compiler).startsWith(realpathSync(${JSON.stringify(server)}) + path.sep), 'Compiler must ship inside worker output');
  await import(${JSON.stringify(worldUrl)});
  const expected = process.argv[1] === 'config';
  assert.equal(Boolean(require.cache[compiler]), expected, 'Compiler must load only for TypeScript config');
  assert.equal(globalThis.chatjsConfigProbe, expected ? 2345 : undefined, 'Bundled loader must execute typed config');
`;
/**
 * Import the actual built loader in a fresh Node process for each config state.
 * @param {string} mode Whether the temporary TypeScript config exists.
 * @returns {void} Throws if the compiler is eager, missing, or cannot load config.
 */
const checkLoader = (mode: string): void => {
  const result = spawnSync("node", ["--input-type=module", "-e", probe, mode], {
    cwd: directory,
    encoding: "utf-8",
    timeout: 30_000,
  });
  assert.equal(result.status, 0, `${mode}: ${result.stderr}`);
};
try {
  checkLoader("default");
  await writeFile(
    path.join(directory, "graphile-worker.config.ts"),
    "const pollInterval: number = 2345;\n" +
      "Reflect.set(globalThis, 'chatjsConfigProbe', pollInterval);\n" +
      "export default { pollInterval };\n"
  );
  checkLoader("config");
  const remaining = await readdir(directory);
  assert.equal(
    remaining.some((file) => file.endsWith(".cjs")),
    false,
    "Temporary compiled config must be removed"
  );
  console.log(
    "Worker compiler externalization and optional TypeScript config passed."
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
