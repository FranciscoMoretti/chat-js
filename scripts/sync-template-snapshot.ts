import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const { join } = path;

export const SNAPSHOT_CONCURRENCY = 32;

const mapWithConcurrency = async <T, R>(
  items: T[],
  mapper: (item: T) => Promise<R>,
  concurrency = SNAPSHOT_CONCURRENCY
): Promise<R[]> => {
  const results: R[] = [];
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= items.length) {
      return;
    }
    results[index] = await mapper(items[index]);
    await worker();
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
};

export const collectSnapshot = async (
  dir: string,
  prefix = ""
): Promise<Map<string, string>> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const snapshots = await mapWithConcurrency(entries, async (entry) => {
    const absolute = join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      return collectSnapshot(absolute, rel);
    }
    if (!entry.isFile()) {
      return new Map<string, string>();
    }
    const bytes = await readFile(absolute);
    const hash = createHash("sha256").update(bytes).digest("hex");
    return new Map([[rel, hash]]);
  });
  const output = new Map<string, string>();
  for (const snapshot of snapshots) {
    for (const [nestedPath, hash] of snapshot) {
      output.set(nestedPath, hash);
    }
  }
  return output;
};
