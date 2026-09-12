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

const collectFileOrder = async (
  dir: string,
  prefix = ""
): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = await Promise.all(
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
