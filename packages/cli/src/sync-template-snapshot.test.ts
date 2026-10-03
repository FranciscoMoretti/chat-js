import { it } from "bun:test";
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import assert from "node:assert/strict";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import {
  SNAPSHOT_CONCURRENCY,
  collectSnapshot,
} from "../../../scripts/sync-template-snapshot";
/* oxlint-enable import/no-relative-parent-imports */

// oxlint-disable-next-line typescript/unbound-method -- The fixture passes a receiver-independent mock or arrow callback so invocation identity remains observable.
const { join } = path;

const hash = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const collectFileOrder = async (
  dir: string,
  prefix = ""
): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = await Promise.all(
    // oxlint-disable-next-line typescript/await-thenable -- Preserve the fixture contract and its runtime assertions; changing this expression would alter the case under test.
    entries.map((entry) => {
      const absolute = join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        return collectFileOrder(absolute, rel);
      }
      return entry.isFile() ? [rel] : [];
    })
  );
  return paths.flat();
};
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
it("collects ordered hashes with bounded nested filesystem concurrency", async () => {
  const root = await mkdtemp(join(process.cwd(), "sync-template-snapshot-"));
  try {
    const nested = join(root, "nested");
    const deeper = join(nested, "deeper");
    await mkdir(deeper, { recursive: true });
    const files = [
      ...Array.from({ length: SNAPSHOT_CONCURRENCY * 4 }, (_, index) =>
        writeFile(join(root, `file-${index}.txt`), `root-${index}`)
      ),
      writeFile(join(nested, "leaf.txt"), "nested-leaf"),
      writeFile(join(deeper, "deep.txt"), "deep-leaf"),
    ];
    await Promise.all(files);
    const siblingDirectories = Array.from({ length: 8 }, (_, index) =>
      join(root, `nested-${index}`)
    );
    await Promise.all(
      siblingDirectories.map(async (directory, directoryIndex) => {
        await mkdir(directory);
        await Promise.all(
          Array.from({ length: 8 }, (_, fileIndex) =>
            writeFile(
              join(directory, `file-${fileIndex}.txt`),
              `nested-${directoryIndex}-${fileIndex}`
            )
          )
        );
      })
    );
    await symlink(join(root, "file-0.txt"), join(root, "ignored-link.txt"));

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
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
