import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const { join } = path;

export const SNAPSHOT_CONCURRENCY = 32;

export type SnapshotOptions = {
  concurrency?: number;
  onActiveOperationsChange?: (activeOperations: number) => void;
};

class SnapshotIoLimiter {
  private activeOperations = 0;
  private readonly concurrency: number;
  private readonly queue: (() => void)[] = [];
  private readonly onActiveOperationsChange?: (
    activeOperations: number
  ) => void;

  constructor({ concurrency, onActiveOperationsChange }: SnapshotOptions) {
    this.concurrency = concurrency ?? SNAPSHOT_CONCURRENCY;
    this.onActiveOperationsChange = onActiveOperationsChange;
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.activeOperations >= this.concurrency) {
      const deferred = Promise.withResolvers<null>();
      this.queue.push(() => deferred.resolve(null));
      await deferred.promise;
    }

    this.activeOperations += 1;
    this.onActiveOperationsChange?.(this.activeOperations);
    try {
      return await operation();
    } finally {
      this.activeOperations -= 1;
      this.onActiveOperationsChange?.(this.activeOperations);
      this.queue.shift()?.();
    }
  }
}

const collectSnapshotWithLimiter = async (
  dir: string,
  prefix: string,
  limiter: SnapshotIoLimiter
): Promise<Map<string, string>> => {
  const entries = await limiter.run(() =>
    readdir(dir, { withFileTypes: true })
  );
  const snapshots = await Promise.all(
    entries.map(async (entry) => {
      const absolute = join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        return collectSnapshotWithLimiter(absolute, rel, limiter);
      }
      if (!entry.isFile()) {
        return new Map<string, string>();
      }
      const bytes = await limiter.run(() => readFile(absolute));
      const hash = createHash("sha256").update(bytes).digest("hex");
      return new Map([[rel, hash]]);
    })
  );
  const output = new Map<string, string>();
  for (const snapshot of snapshots) {
    for (const [nestedPath, hash] of snapshot) {
      output.set(nestedPath, hash);
    }
  }
  return output;
};

export const collectSnapshot = (
  dir: string,
  prefix = "",
  options: SnapshotOptions = {}
): Promise<Map<string, string>> =>
  collectSnapshotWithLimiter(dir, prefix, new SnapshotIoLimiter(options));
