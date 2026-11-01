import {
  SNAPSHOT_CONCURRENCY,
  collectSnapshot,
} from "../../../scripts/sync-template-snapshot";
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import assert from "node:assert/strict";
import { it } from "bun:test";
import path from "node:path";

const hash = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

const FILES_PER_CONCURRENCY_BATCH = 4;
const SIBLING_DIRECTORY_COUNT = 8;
const FILES_PER_SIBLING_DIRECTORY = 8;
const FIRST_FILE_INDEX = 0;
const NO_ACTIVE_OPERATIONS = 0;
const MINIMUM_CONCURRENT_OPERATIONS = 1;

it.each([0, -1, 1.5, Number.NaN])(
  "rejects invalid snapshot concurrency before starting filesystem operations: %s",
  async (concurrency) => {
    const activeOperations: number[] = [];
    await assert.rejects(
      collectSnapshot("unused", "", {
        concurrency,
        onActiveOperationsChange: (active) => {
          activeOperations.push(active);
        },
      }),
      {
        message: "Snapshot concurrency must be a positive integer",
        name: "RangeError",
      }
    );
    assert.deepEqual(activeOperations, []);
  }
);

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
it("collects ordered hashes with bounded nested filesystem concurrency", async () => {
  const root = await mkdtemp(
    path.join(process.cwd(), "sync-template-snapshot-")
  );
  try {
    const nested = path.join(root, "nested");
    const deeper = path.join(nested, "deeper");
    await mkdir(deeper, { recursive: true });
    const files = [
      ...Array.from(
        { length: SNAPSHOT_CONCURRENCY * FILES_PER_CONCURRENCY_BATCH },
        async (_, index) => {
          await writeFile(
            path.join(root, `file-${index}.txt`),
            `root-${index}`
          );
        }
      ),
      writeFile(path.join(nested, "leaf.txt"), "nested-leaf"),
      writeFile(path.join(deeper, "deep.txt"), "deep-leaf"),
    ];
    await Promise.all(files);
    const siblingDirectories = Array.from(
      { length: SIBLING_DIRECTORY_COUNT },
      (_, index) => path.join(root, `nested-${index}`)
    );
    await Promise.all(
      siblingDirectories.map(async (directory, directoryIndex) => {
        await mkdir(directory);
        await Promise.all(
          Array.from(
            { length: FILES_PER_SIBLING_DIRECTORY },
            async (_, fileIndex) => {
              await writeFile(
                path.join(directory, `file-${fileIndex}.txt`),
                `nested-${directoryIndex}-${fileIndex}`
              );
            }
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
    assert.equal(activeOperations, NO_ACTIVE_OPERATIONS);
    assert.ok(peakOperations > MINIMUM_CONCURRENT_OPERATIONS);
    assert.ok(peakOperations <= SNAPSHOT_CONCURRENCY);

    const expectedOrder = await collectFileOrder(root);
    assert.deepEqual([...snapshot.keys()], expectedOrder);
    assert.equal(
      snapshot.get(`file-${FIRST_FILE_INDEX}.txt`),
      hash(`root-${FIRST_FILE_INDEX}`)
    );
    assert.equal(snapshot.has("ignored-link.txt"), false);
    assert.equal(snapshot.get("nested/leaf.txt"), hash("nested-leaf"));
    assert.equal(snapshot.get("nested/deeper/deep.txt"), hash("deep-leaf"));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
