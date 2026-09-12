import { it } from "bun:test";
import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  SNAPSHOT_CONCURRENCY,
  collectSnapshot,
} from "../../../scripts/sync-template-snapshot";

const { join } = path;

const hash = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

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
    assert.ok(peakOperations <= SNAPSHOT_CONCURRENCY);

    const entries = await readdir(root, { withFileTypes: true });
    const nestedEntries = await readdir(nested, { withFileTypes: true });
    const deepEntries = await readdir(deeper, { withFileTypes: true });
    const expectedOrder = entries.flatMap((entry) => {
      if (entry.isDirectory()) {
        return nestedEntries.flatMap((nestedEntry) => {
          if (nestedEntry.isDirectory()) {
            return deepEntries
              .filter((deepEntry) => deepEntry.isFile())
              .map(
                (deepEntry) =>
                  `${entry.name}/${nestedEntry.name}/${deepEntry.name}`
              );
          }
          if (nestedEntry.isFile()) {
            return [`${entry.name}/${nestedEntry.name}`];
          }
          return [];
        });
      }
      if (entry.isFile()) {
        return [entry.name];
      }
      return [];
    });
    assert.deepEqual([...snapshot.keys()], expectedOrder);
    assert.equal(snapshot.get("file-0.txt"), hash("root-0"));
    assert.equal(snapshot.has("ignored-link.txt"), false);
    assert.equal(snapshot.get("nested/leaf.txt"), hash("nested-leaf"));
    assert.equal(snapshot.get("nested/deeper/deep.txt"), hash("deep-leaf"));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
