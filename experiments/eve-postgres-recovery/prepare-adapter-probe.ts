/* oxlint-disable import/no-nodejs-modules, no-console -- The local proof prepares a hash-pinned driver and prints its path. */
import assert from "node:assert/strict";
import path from "node:path";

const repo = path.resolve(import.meta.dir, "../..");
const shared = path.join(repo, "tests/eve-retirement-runtime");
const provider = path.join(
  import.meta.dir,
  "node_modules/@workflow/world-postgres"
);
const source = await Bun.file(path.join(shared, "restart.ts")).text();
assert.equal(
  new Bun.CryptoHasher("sha256").update(source).digest("hex"),
  "1b7b294b0effb2137f7497ce8f81a125426668eb8029778374e02ab940ccedf9"
);
// Keep EVE and its client fixed. Only the experimental provider symlink changes.
const replacement = `if (postgres) {
 const fs = await import('node:fs/promises');
 const link = path.join(postgres.nodeModules,'@workflow/world-postgres');
 await fs.unlink(link);
 await fs.symlink(${JSON.stringify(provider)},link);
 await Bun.write(path.join(postgres.source,'adapter-candidate.json'),JSON.stringify({version:'5.0.2',graphile:'0.16.6',provider:${JSON.stringify(provider)}}));
}
const runtime = await createPersistentRuntime(`;
const script = source
  .replace(
    'from "eve/client"',
    `from "${shared}/node_modules/eve/dist/src/client/index.js"`
  )
  .replaceAll('from "./', `from "${shared}/`)
  .replaceAll("import.meta.dir", JSON.stringify(shared))
  .replace("const runtime = await createPersistentRuntime(", replacement)
  .replace(
    "Published eve@0.71.3 with ChatJS patched PostgreSQL beta.40",
    "Published eve@0.71.3 with experimental Postgres World5.0.2"
  )
  .replace("await runtime.remove();", "await runtime.crash();");
const output = path.join(repo, "apps/chat/.eve/oct8/released.ts");
await Bun.write(output, script);
console.log(output);
/* oxlint-enable import/no-nodejs-modules, no-console */
