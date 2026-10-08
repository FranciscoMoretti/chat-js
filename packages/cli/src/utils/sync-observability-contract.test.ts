import { expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Pinned Oxfmt 0.67.0 restores this declaration order after a native sort-imports-clean reorder: Oxfmt places node:os (tmpdir) before node:path (path); sort-imports requires the reverse. */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import path from "node:path";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Pinned Oxfmt 0.67.0 restores this declaration order after a native sort-imports-clean reorder: Oxfmt places node:path (path) before ./sync-observability (initializeObservability); sort-imports requires the reverse. */
import { initializeObservability } from "./sync-observability";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve manifestFixture's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

const manifestFixture = async (manifest: string): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "observability-manifest-"));
  await writeFile(path.join(root, "package.json"), manifest);
  return root;
};
/* oxlint-enable oxc/no-async-await */
const originalManifest =
  '{"extension":{"nested":["keep"]},"dependencies":{"retain":{"unusual":"metadata"},"@vercel/analytics":"^1","@vercel/speed-insights":"^1","@vercel/otel":"^1","langfuse-vercel":"^1","langfuse":"^1"},"scripts":{"keep":"command"}}';
const expectedManifest = `{
  "extension": {
    "nested": [
      "keep"
    ]
  },
  "dependencies": {
    "retain": {
      "unusual": "metadata"
    }
  },
  "scripts": {
    "keep": "command"
  }
}
`;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("observability initialization preserves unknown metadata and field order while deleting only demo dependencies", async () => {
  const root = await manifestFixture(originalManifest);
  try {
    await initializeObservability(root);
    expect(await readFile(path.join(root, "package.json"), "utf-8")).toBe(
      expectedManifest
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("observability initialization preserves the existing null dependency sentinel", async () => {
  const root = await manifestFixture(
    '{"extension":"keep","dependencies":null}'
  );
  try {
    await initializeObservability(root);
    expect(await readFile(path.join(root, "package.json"), "utf-8")).toBe(`{
  "extension": "keep",
  "dependencies": null
}
`);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each(["[]", "null", '{"dependencies":[]}', '{"dependencies":"bad"}'])'s awaited sequencing and rejected-Promise behavior. */
test.each(["[]", "null", '{"dependencies":[]}', '{"dependencies":"bad"}'])(
  "observability initialization rejects malformed manifest %s before writing it",
  async (manifest) => {
    const root = await manifestFixture(manifest);
    try {
      expect(initializeObservability(root)).rejects.toThrow(TypeError);
      expect(await readFile(path.join(root, "package.json"), "utf-8")).toBe(
        manifest
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  }
);
/* oxlint-enable oxc/no-async-await */
