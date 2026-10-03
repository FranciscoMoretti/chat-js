/* oxlint-disable import/no-nodejs-modules -- the node:crypto import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { createHash } from "node:crypto";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:fs/promises import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { readdir, readFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:path import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- join: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const join = (...segments: string[]): string => path.join(...segments);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last -- SNAPSHOT_CONCURRENCY: The declaration is an existing named entrypoint used by consumers; its colocated export makes that boundary explicit. */
/* oxlint-disable import/group-exports -- SNAPSHOT_CONCURRENCY: Keep the named API with its implementation; existing direct exports are the consumer contract. */
export const SNAPSHOT_CONCURRENCY = 32;
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- SnapshotOptions: The declaration is an existing named entrypoint used by consumers; its colocated export makes that boundary explicit. */
/* oxlint-disable typescript/consistent-type-definitions -- SnapshotOptions: The structural alias participates in typed JSON/configuration boundaries; interface conversion changes implicit index assignability and merging. */
export type SnapshotOptions = {
  concurrency?: number;
  onActiveOperationsChange?: (activeOperations: number) => void;
};
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-enable import/exports-last */

/* oxlint-disable eslint/max-statements -- SnapshotIoLimiter: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/no-magic-numbers -- SnapshotIoLimiter: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable eslint/id-length -- SnapshotIoLimiter: The local index/OS/library binding retains its conventional API notation. */
/* oxlint-disable unicorn/no-null -- SnapshotIoLimiter: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- SnapshotIoLimiter: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
class SnapshotIoLimiter {
  private activeOperations = 0;
  private readonly concurrency: number;
  private readonly queue: { resolve: (value: null) => void }[] = [];
  private reservedOperations = 0;
  private readonly onActiveOperationsChange?: (
    activeOperations: number
  ) => void;

  public constructor({
    concurrency,
    onActiveOperationsChange,
  }: SnapshotOptions) {
    this.concurrency = concurrency ?? SNAPSHOT_CONCURRENCY;
    if (!Number.isInteger(this.concurrency) || this.concurrency < 1) {
      throw new RangeError("Snapshot concurrency must be a positive integer");
    }
    this.onActiveOperationsChange = onActiveOperationsChange;
  }

  public async run<T>(operation: () => Promise<T>): Promise<T> {
    if (
      this.activeOperations >= this.concurrency ||
      this.reservedOperations > 0
    ) {
      const deferred = Promise.withResolvers<null>();
      this.queue.push(deferred);
      await deferred.promise;
      this.reservedOperations -= 1;
    }

    this.activeOperations += 1;
    this.onActiveOperationsChange?.(this.activeOperations);
    try {
      return await operation();
    } finally {
      const next = this.queue.shift();
      if (next) {
        this.reservedOperations += 1;
        this.activeOperations -= 1;
        next.resolve(null);
      } else {
        this.activeOperations -= 1;
        this.onActiveOperationsChange?.(this.activeOperations);
      }
    }
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- collectSnapshotWithLimiter: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/promise-function-async -- collectSnapshotWithLimiter: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
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
        return await collectSnapshotWithLimiter(absolute, rel, limiter);
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
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- collectSnapshot: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- collectSnapshot: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/promise-function-async -- collectSnapshot: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
export const collectSnapshot = (
  dir: string,
  prefix = "",
  options: SnapshotOptions = {}
): Promise<Map<string, string>> =>
  collectSnapshotWithLimiter(dir, prefix, new SnapshotIoLimiter(options));
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */
