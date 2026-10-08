import { expect, spyOn } from "bun:test";
/* oxlint-disable import/no-nodejs-modules -- These Bun test fixtures snapshot real files, inject Node rename/rm failures, and observe actual rollback cleanup operations. */
import fs, { readFile, readdir } from "node:fs/promises";
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

type ReadonlyNativeSurface<Value> = Value extends
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined
  ? Value
  : Value extends (...parameters: readonly never[]) => unknown
    ? Value
    : Value extends abstract new (...parameters: readonly never[]) => unknown
      ? Value
      : Value extends object
        ? {
            readonly [Property in keyof Value]: ReadonlyNativeSurface<
              Value[Property]
            >;
          }
        : Value;

interface SyncFixture {
  baseline: string;
  expected: Map<string, string>;
  root: string;
}
interface FixtureSnapshot {
  readonly source: string;
  readonly baseline: string;
}

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve prepareReplacement's awaited sequencing and rejected-Promise behavior. */
const prepareReplacement = async (
  createFixture: () => Promise<SyncFixture>,
  failure: string
): Promise<{
  readonly options: SyncFixture;
  readonly previous: FixtureSnapshot;
  readonly target: string;
}> => {
  const options = await createFixture();
  const previous = {
    baseline: await readFile(options.baseline, "utf-8"),
    source: await readFile(
      path.join(options.root, "implementation.ts"),
      "utf-8"
    ),
  };
  options.expected.set("implementation.ts", "// updated canonical\n");
  options.expected.set("new.ts", "// new canonical\n");
  const target =
    // oxlint-disable-next-line no-ternary -- Keep target as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    failure === "baseline"
      ? options.baseline
      : path.join(options.root, "new.ts");
  return { options, previous, target };
};
/* oxlint-enable oxc/no-async-await */
const replacementFailure = (
  root: string,
  target: string
): {
  readonly assertTriggered: () => void;
  readonly restore: () => void;
} => {
  const originalRename = fs.rename;
  let replacedSource = false;
  let failed = false;
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve rename's awaited sequencing and rejected-Promise behavior. */
  const rename = spyOn(fs, "rename").mockImplementation(
    async (...args: ReadonlyNativeSurface<Parameters<typeof fs.rename>>) => {
      const [source, destination] = args;
      if (
        destination === target &&
        path.basename(String(source)) === "next" &&
        !failed
      ) {
        failed = true;
        throw new Error("Injected replacement failure");
      }
      await originalRename(source, destination);
      if (destination === path.join(root, "implementation.ts")) {
        replacedSource = true;
      }
    }
  );
  /* oxlint-enable oxc/no-async-await */
  return {
    assertTriggered: () => {
      expect(failed).toBe(true);
      expect(replacedSource).toBe(true);
    },
    restore: () => {
      rename.mockRestore();
    },
  };
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve verifyRollback's awaited sequencing and rejected-Promise behavior. */
const verifyRollback = async (
  options: ReadonlyNativeSurface<SyncFixture>,
  previous: FixtureSnapshot
): Promise<void> => {
  expect(
    await readFile(path.join(options.root, "implementation.ts"), "utf-8")
  ).toBe(previous.source);
  expect(await readFile(options.baseline, "utf-8")).toBe(previous.baseline);
  expect(await Bun.file(path.join(options.root, "new.ts")).exists()).toBe(
    false
  );
  const entries = await readdir(options.root);
  expect(entries.some((file) => file.startsWith(".demo-sync-"))).toBe(false);
};
/* oxlint-enable oxc/no-async-await */
const observeGeneratorFailure = (): {
  readonly cleanedPaths: readonly string[];
  readonly restore: () => void;
} => {
  const originalRm = fs.rm;
  const cleanedPaths: string[] = [];
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve remove's awaited sequencing and rejected-Promise behavior. */
  const remove = spyOn(fs, "rm").mockImplementation(
    async (...args: ReadonlyNativeSurface<Parameters<typeof fs.rm>>) => {
      const [target, options] = args;
      cleanedPaths.push(String(target));
      await originalRm(target, options);
    }
  );
  /* oxlint-enable oxc/no-async-await */
  const serve = spyOn(Bun, "serve").mockImplementation(() => {
    throw new Error("Injected server setup failure");
  });
  return {
    cleanedPaths,
    restore: () => {
      remove.mockRestore();
      serve.mockRestore();
    },
  };
};

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (observeGeneratorFailure, prepareReplacement, replacementFailure, verifyRollback); the enabled import/no-default-export convention rejects the default-export alternative. */
export {
  observeGeneratorFailure,
  prepareReplacement,
  replacementFailure,
  verifyRollback,
};
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Keep the named type bindings (ReadonlyNativeSurface); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { ReadonlyNativeSurface };
/* oxlint-enable import/no-named-export */
