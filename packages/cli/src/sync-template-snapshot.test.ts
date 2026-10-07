import { it } from "bun:test";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun test uses native assertions to await rejection and verify integration contracts.
import assert from "node:assert/strict";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
/* oxlint-enable sort-imports */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import path from "node:path";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  SNAPSHOT_CONCURRENCY,
  collectSnapshot,
} from "../../../scripts/sync-template-snapshot";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

const hash = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve collectFileOrder's awaited sequencing and rejected-Promise behavior. */
const collectFileOrder = async (
  dir: string,
  prefix = ""
): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(
      async (
        entry: Readonly<{
          name: string;
          isDirectory: () => boolean;
          isFile: () => boolean;
        }>
      ): Promise<string[]> => {
        const absolute = path.join(dir, entry.name);
        // oxlint-disable-next-line no-ternary -- Keep rel as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          return await collectFileOrder(absolute, rel);
        }
        if (entry.isFile()) {
          return [rel];
        }
        return [];
      }
    )
  );
  return paths.flat();
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
it("collects ordered hashes with bounded nested filesystem concurrency", async () => {
  const root = await mkdtemp(
    path.join(process.cwd(), "sync-template-snapshot-")
  );
  try {
    const nested = path.join(root, "nested");
    const deeper = path.join(nested, "deeper");
    await mkdir(deeper, { recursive: true });
    const files = [
      ...Array.from({ length: SNAPSHOT_CONCURRENCY * 4 }, (_, index) =>
        writeFile(path.join(root, `file-${index}.txt`), `root-${index}`)
      ),
      writeFile(path.join(nested, "leaf.txt"), "nested-leaf"),
      writeFile(path.join(deeper, "deep.txt"), "deep-leaf"),
    ];
    await Promise.all(files);
    const siblingDirectories = Array.from({ length: 8 }, (_, index) =>
      path.join(root, `nested-${index}`)
    );
    await Promise.all(
      siblingDirectories.map(async (directory, directoryIndex) => {
        await mkdir(directory);
        await Promise.all(
          Array.from({ length: 8 }, (_, fileIndex) =>
            writeFile(
              path.join(directory, `file-${fileIndex}.txt`),
              `nested-${directoryIndex}-${fileIndex}`
            )
          )
        );
      })
    );
    await symlink(
      path.join(root, "file-0.txt"),
      path.join(root, "ignored-link.txt")
    );

    let activeOperations = 0;
    let peakOperations = 0;
    const snapshot = await collectSnapshot(root, "", {
      onActiveOperationsChange: (active) => {
        activeOperations = active;
        peakOperations = Math.max(peakOperations, active);
      },
    });
    assert.equal(activeOperations, 0);
    assert.ok(peakOperations > 1);
    assert.ok(peakOperations <= SNAPSHOT_CONCURRENCY);

    const expectedOrder = await collectFileOrder(root);
    assert.deepEqual([...snapshot.keys()], expectedOrder);
    assert.equal(snapshot.get("file-0.txt"), hash("root-0"));
    assert.equal(snapshot.has("ignored-link.txt"), false);
    assert.equal(snapshot.get("nested/leaf.txt"), hash("nested-leaf"));
    assert.equal(snapshot.get("nested/deeper/deep.txt"), hash("deep-leaf"));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
