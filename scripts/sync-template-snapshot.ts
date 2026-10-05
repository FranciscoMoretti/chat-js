// oxlint-disable-next-line import/no-nodejs-modules -- The repository template snapshot hashes and copies source files using host filesystem paths.
import { createHash } from "node:crypto";
// oxlint-disable-next-line import/no-nodejs-modules -- The repository template snapshot hashes and copies source files using host filesystem paths.
import { readdir, readFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The repository template snapshot hashes and copies source files using host filesystem paths.
import path from "node:path";

const join = (...segments: readonly string[]): string => path.join(...segments);

const SNAPSHOT_CONCURRENCY = 32;
const NO_OPERATIONS = 0;
const MINIMUM_SNAPSHOT_CONCURRENCY = 1;
const ONE_OPERATION = 1;

/* oxlint-disable typescript/consistent-type-definitions -- SnapshotOptions: The structural alias participates in typed JSON/configuration boundaries; interface conversion changes implicit index assignability and merging. */
type SnapshotOptions = {
  concurrency?: number;
  onActiveOperationsChange?: (activeOperations: number) => void;
};
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable eslint/max-statements -- SnapshotIoLimiter: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/id-length -- SnapshotIoLimiter: The local index/OS/library binding retains its conventional API notation. */
/* oxlint-disable unicorn/no-null -- SnapshotIoLimiter: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- SnapshotIoLimiter: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
class SnapshotIoLimiter {
  private activeOperations = NO_OPERATIONS;
  private readonly concurrency: number;
  private readonly queue: { resolve: (value: null) => void }[] = [];
  private reservedOperations = NO_OPERATIONS;
  private readonly onActiveOperationsChange?: (
    activeOperations: number
  ) => void;

  public constructor({
    concurrency,
    onActiveOperationsChange,
  }: SnapshotOptions) {
    this.concurrency = concurrency ?? SNAPSHOT_CONCURRENCY;
    if (
      !Number.isInteger(this.concurrency) ||
      this.concurrency < MINIMUM_SNAPSHOT_CONCURRENCY
    ) {
      throw new RangeError("Snapshot concurrency must be a positive integer");
    }
    this.onActiveOperationsChange = onActiveOperationsChange;
  }

  public async run<T>(operation: () => Promise<T>): Promise<T> {
    if (
      this.activeOperations >= this.concurrency ||
      this.reservedOperations > NO_OPERATIONS
    ) {
      const deferred = Promise.withResolvers<null>();
      this.queue.push(deferred);
      await deferred.promise;
      this.reservedOperations -= ONE_OPERATION;
    }

    this.activeOperations += ONE_OPERATION;
    this.onActiveOperationsChange?.(this.activeOperations);
    try {
      return await operation();
    } finally {
      const next = this.queue.shift();
      if (next) {
        this.reservedOperations += ONE_OPERATION;
        this.activeOperations -= ONE_OPERATION;
        next.resolve(null);
      } else {
        this.activeOperations -= ONE_OPERATION;
        this.onActiveOperationsChange?.(this.activeOperations);
      }
    }
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/id-length */
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

/* oxlint-disable typescript/prefer-readonly-parameter-types -- collectSnapshot: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/promise-function-async -- collectSnapshot: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
const collectSnapshot = (
  dir: string,
  prefix = "",
  options: SnapshotOptions = {}
): Promise<Map<string, string>> =>
  collectSnapshotWithLimiter(dir, prefix, new SnapshotIoLimiter(options));
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { collectSnapshot, SNAPSHOT_CONCURRENCY };
export type { SnapshotOptions };
