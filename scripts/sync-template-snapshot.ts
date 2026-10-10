// oxlint-disable-next-line import/no-nodejs-modules -- The repository template snapshot hashes and copies source files using host filesystem paths.
import { readFile, readdir } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The repository template snapshot hashes and copies source files using host filesystem paths.
import { createHash } from "node:crypto";
// oxlint-disable-next-line import/no-nodejs-modules -- The repository template snapshot hashes and copies source files using host filesystem paths.
import path from "node:path";

const join = (...segments: readonly string[]): string => path.join(...segments);

const SNAPSHOT_CONCURRENCY = 32;
const NO_OPERATIONS = 0;
const MINIMUM_SNAPSHOT_CONCURRENCY = 1;
const ONE_OPERATION = 1;

/* oxlint-disable typescript/consistent-type-definitions -- The exported SnapshotOptions alias retains implicit Record index assignability; converting it to an interface changes that structural contract. */
type SnapshotOptions = {
  concurrency?: number;
  onActiveOperationsChange?: (activeOperations: number) => void;
};
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable unicorn/no-null -- The private deferred queue fulfills its declared Promise<null> when releasing a reserved slot; keep the existing fulfillment value. */
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
  }: Readonly<SnapshotOptions>) {
    this.concurrency = concurrency ?? SNAPSHOT_CONCURRENCY;
    if (
      !Number.isInteger(this.concurrency) ||
      this.concurrency < MINIMUM_SNAPSHOT_CONCURRENCY
    ) {
      throw new RangeError("Snapshot concurrency must be a positive integer");
    }
    this.onActiveOperationsChange = onActiveOperationsChange;
  }

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve run's awaited sequencing and rejected-Promise behavior. */
  public async run<Result>(operation: () => Promise<Result>): Promise<Result> {
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling this.onActiveOperationsChange; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result.
    this.onActiveOperationsChange?.(this.activeOperations);
    try {
      return await operation();
    } finally {
      this.release();
    }
  }
  /* oxlint-enable oxc/no-async-await */

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      this.reservedOperations += ONE_OPERATION;
      this.activeOperations -= ONE_OPERATION;
      next.resolve(null);
    } else {
      this.activeOperations -= ONE_OPERATION;
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling this.onActiveOperationsChange; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result.
      this.onActiveOperationsChange?.(this.activeOperations);
    }
  }
}
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve collectSnapshotWithLimiter's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable typescript/promise-function-async -- The readdir/readFile callbacks hand their native promises directly to the limiter; async changes promise identity and synchronous throw timing. */
const collectSnapshotWithLimiter = async (
  dir: string,
  prefix: string,
  limiter: Readonly<SnapshotIoLimiter>
): Promise<Map<string, string>> => {
  const entries = await limiter.run(() =>
    readdir(dir, { withFileTypes: true })
  );
  const snapshots = await Promise.all(
    entries.map(async (entry: Readonly<(typeof entries)[number]>) => {
      const absolute = join(dir, entry.name);
      // oxlint-disable-next-line no-ternary -- Keep rel as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable typescript/promise-function-async -- collectSnapshot: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
const collectSnapshot = (
  dir: string,
  prefix = "",
  options: Readonly<SnapshotOptions> = {}
): Promise<Map<string, string>> =>
  collectSnapshotWithLimiter(dir, prefix, new SnapshotIoLimiter(options));
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (collectSnapshot, SNAPSHOT_CONCURRENCY); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable typescript/promise-function-async */
export { collectSnapshot, SNAPSHOT_CONCURRENCY };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (SnapshotOptions); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { SnapshotOptions };
/* oxlint-enable import/no-named-export */
