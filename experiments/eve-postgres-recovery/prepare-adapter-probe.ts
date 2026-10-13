import assert from "node:assert/strict";
import path from "node:path";

const repo = path.resolve(import.meta.dir, "../..");
const shared = path.join(repo, "tests/eve-retirement-runtime");
const provider = path.join(
  import.meta.dir,
  "node_modules/@workflow/world-postgres"
);
// Updated for the Oct 13 lint-only maintenance of the preserved Oct 8 controller.
const source = await Bun.file(path.join(shared, "restart.ts")).text();
assert.equal(
  new Bun.CryptoHasher("sha256").update(source).digest("hex"),
  "eb5ac890673e1c44da4160eed2338e68518c25a2955d5c140adc974826cd2e30"
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
const auditedScript = script
  .split("\n")
  .map((line) =>
    line.startsWith("import ") && line.includes(`from "${shared}/`)
      ? `// oxlint-disable-next-line import/no-absolute-path -- This isolated adapter comparison must bind the exact pinned shared runtime installation.\n${line}`
      : line
  )
  .join("\n");
await Bun.write(output, auditedScript);
console.log(output);
