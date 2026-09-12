import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  SNAPSHOT_CONCURRENCY,
  collectSnapshot,
} from "./sync-template-snapshot";

const { join } = path;

const hash = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

it("collects ordered hashes for nested high-fanout fixtures and skips symlinks", async () => {
  const root = await mkdtemp(join(process.cwd(), "sync-template-snapshot-"));
  try {
    const nested = join(root, "nested");
    await mkdir(nested);
    const files = Array.from({ length: SNAPSHOT_CONCURRENCY * 4 }, (_, index) =>
      writeFile(join(root, `file-${index}.txt`), `root-${index}`)
    );
    files.push(writeFile(join(nested, "leaf.txt"), "nested-leaf"));
    await Promise.all(files);
    await symlink(join(root, "file-0.txt"), join(root, "ignored-link.txt"));

    const snapshot = await collectSnapshot(root);
    const expected = new Map(
      [
        ...Array.from(
          { length: SNAPSHOT_CONCURRENCY * 4 },
          (_, index) => [`file-${index}.txt`, hash(`root-${index}`)] as const
        ),
        ["nested/leaf.txt", hash("nested-leaf")] as const,
      ].toSorted(([a], [b]) => a.localeCompare(b))
    );

    assert.deepEqual(
      [...snapshot.entries()].toSorted(([a], [b]) => a.localeCompare(b)),
      [...expected.entries()]
    );
    assert.equal(snapshot.has("ignored-link.txt"), false);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
