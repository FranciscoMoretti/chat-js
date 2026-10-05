import { afterEach, expect, spyOn, test } from "bun:test";
/* oxlint-disable import/no-nodejs-modules -- Exercise real Node rename/symlink rollback and source/baseline snapshots; Bun.file read/write alone cannot provide those filesystem operations. */
import fs, {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- Use the host OS temporary directory for disposable fixtures; a hardcoded /tmp path or direct TMPDIR read is not portable. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- Resolve repository, staging, and temporary paths with host path semantics; URL/string concatenation does not preserve arbitrary Windows filesystem paths. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable import/no-relative-parent-imports -- Exercise the canonical package demo installer; @/ resolves application source and package exports expose only registry JSON artifacts. */
import { generateDemo, syncDemo } from "../scripts/demo-sync";
import {
  observeGeneratorFailure,
  prepareReplacement,
  replacementFailure,
  verifyRollback,
} from "./demo-sync-test-support";
import type { ReadonlyNativeSurface } from "./demo-sync-test-support";
/* oxlint-enable import/no-relative-parent-imports */
import { jsonObject, parseJsonObject } from "./test-json";

const FIRST_DIRECTORY_INDEX = 0;
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(FIRST_DIRECTORY_INDEX).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    })
  );
});
const fixture = async (): Promise<{
  baseline: string;
  expected: Map<string, string>;
  root: string;
}> => {
  const root = await mkdtemp(path.join(tmpdir(), "demo-sync-test-"));
  directories.push(root);
  const baseline = path.join(root, "baseline.json");
  const expected = new Map([
    ["implementation.ts", "// canonical\nexport type Result = string;\n"],
  ]);
  await syncDemo({ baseline, expected, root });
  return { baseline, expected, root };
};

const verifyCanonicalChange = async (
  original: ReadonlyNativeSurface<Awaited<ReturnType<typeof fixture>>>,
  source: string
): Promise<void> => {
  const options = {
    ...original,
    expected: new Map([...original.expected, ["implementation.ts", source]]),
  };
  expect(syncDemo({ ...options, check: true })).rejects.toThrow(
    "Demo source drift"
  );
  await syncDemo(options);
  await syncDemo({ ...options, check: true });
};

test("types and comments drift; canonical changes sync and repeated sync is deterministic", async () => {
  const fixtureOptions = await fixture();
  const before = await readFile(fixtureOptions.baseline, "utf-8");
  await syncDemo(fixtureOptions);
  expect(await readFile(fixtureOptions.baseline, "utf-8")).toBe(before);
  await verifyCanonicalChange(
    fixtureOptions,
    "// revised comment\nexport type Result = string;\n"
  );
  await verifyCanonicalChange(
    fixtureOptions,
    "// canonical\nexport type Result = number;\n"
  );
});

test("local edits stop all writes; explicit discard restores canonical source", async () => {
  const options = await fixture();
  await writeFile(
    path.join(options.root, "implementation.ts"),
    "// local edit\n"
  );
  const before = await readFile(options.baseline, "utf-8");
  options.expected.set("new.ts", "// new upstream file\n");
  expect(syncDemo(options)).rejects.toThrow("implementation.ts");
  expect(await Bun.file(path.join(options.root, "new.ts")).exists()).toBe(
    false
  );
  expect(await readFile(options.baseline, "utf-8")).toBe(before);
  await syncDemo({ ...options, discard: true });
  const actual = await readFile(
    path.join(options.root, "implementation.ts"),
    "utf-8"
  );
  expect(options.expected.get("implementation.ts")).toBe(actual);
});

test("missing tracked files are edits and an untracked existing file is protected", async () => {
  const options = await fixture();
  await rm(path.join(options.root, "implementation.ts"));
  expect(syncDemo(options)).rejects.toThrow("Edited registry-owned demo files");
  await syncDemo({ ...options, discard: true });
  await writeFile(path.join(options.root, "new.ts"), "// user file\n");
  options.expected.set("new.ts", "// canonical file\n");
  expect(syncDemo(options)).rejects.toThrow("new.ts");
});

test("sync preserves app-owned UI order and extensions and rejects removed ownership", async () => {
  const options = await fixture();
  const files = [
    "composer-controls.ts",
    "settings-items.ts",
    "tools/chatjs/custom-tools.ts",
    "tools/chatjs/custom-ui.ts",
  ];
  await Promise.all(
    files.map(async (file) => {
      await mkdir(path.dirname(path.join(options.root, file)), {
        recursive: true,
      });
      await writeFile(
        path.join(options.root, file),
        "// app-owned order and extensions\n"
      );
    })
  );
  await syncDemo(options);
  expect(
    await Promise.all(
      files.map(async (file) => {
        const source = await readFile(path.join(options.root, file), "utf-8");
        return source;
      })
    )
  ).toEqual(files.map(() => "// app-owned order and extensions\n"));
  expect(syncDemo({ ...options, expected: new Map() })).rejects.toThrow(
    "removal is outside demo sync scope"
  );
});

test("symlink destinations are rejected before writes", async () => {
  const options = await fixture();
  await symlink(
    path.join(options.root, "implementation.ts"),
    path.join(options.root, "linked.ts")
  );
  options.expected.set("linked.ts", "// canonical\n");
  const before = await readFile(
    path.join(options.root, "implementation.ts"),
    "utf-8"
  );
  expect(syncDemo({ ...options, discard: true })).rejects.toThrow("symlink");
  expect(
    await readFile(path.join(options.root, "implementation.ts"), "utf-8")
  ).toBe(before);
});

test("edits moved upstream can advance the baseline without discarding", async () => {
  const options = await fixture();
  const source =
    "// edit now canonical upstream\nexport type Result = number;\n";
  await writeFile(path.join(options.root, "implementation.ts"), source);
  options.expected.set("implementation.ts", source);
  expect(syncDemo({ ...options, check: true })).rejects.toThrow(
    `Baseline drift: ${options.baseline}`
  );
  await syncDemo(options);
  await syncDemo({ ...options, check: true });
  expect(
    await readFile(path.join(options.root, "implementation.ts"), "utf-8")
  ).toBe(source);
});

test("baseline key ordering uses locale-independent code-unit order", async () => {
  const options = await fixture();
  const names = ["z.ts", "é.ts", "a.ts", "Z.ts", "_a.ts"];
  for (const file of names) {
    options.expected.set(file, "// canonical\n");
  }
  const collation = spyOn(String.prototype, "localeCompare").mockImplementation(
    () => {
      throw new Error("Locale-dependent ordering");
    }
  );
  try {
    await syncDemo(options);
  } finally {
    collation.mockRestore();
  }
  const baseline = parseJsonObject(await readFile(options.baseline, "utf-8"));
  expect(Object.keys(jsonObject(baseline.files))).toEqual(
    [...options.expected.keys()].toSorted()
  );
});

test.each(["source", "baseline"])(
  "a failed %s replacement restores prior source and baseline, permitting retry",
  async (failure) => {
    const { options, previous, target } = await prepareReplacement(
      fixture,
      failure
    );
    const injected = replacementFailure(options.root, target);
    try {
      expect(syncDemo(options)).rejects.toThrow("Injected replacement failure");
    } finally {
      injected.restore();
    }
    injected.assertTriggered();
    await verifyRollback(options, previous);
    await syncDemo(options);
    await syncDemo({ ...options, check: true });
  }
);

test("a symlinked baseline is rejected before source or external target writes", async () => {
  const options = await fixture();
  const external = path.join(options.root, "external.json");
  const before = await readFile(options.baseline, "utf-8");
  await writeFile(external, before);
  await rm(options.baseline);
  await fs.symlink(external, options.baseline);
  options.expected.set("implementation.ts", "// changed canonical\n");
  expect(syncDemo(options)).rejects.toThrow("symlink");
  expect(await readFile(external, "utf-8")).toBe(before);
  expect(
    await readFile(path.join(options.root, "implementation.ts"), "utf-8")
  ).toBe("// canonical\nexport type Result = string;\n");
});

test("generator setup failure removes its temporary installation directory", () => {
  const observed = observeGeneratorFailure();
  try {
    expect(generateDemo()).rejects.toThrow("Injected server setup failure");
  } finally {
    observed.restore();
  }
  const [temporary] = observed.cleanedPaths;
  if (typeof temporary !== "string") {
    throw new TypeError("Generator did not clean up its temporary directory");
  }
  expect(path.basename(temporary).startsWith("chatjs-demo-")).toBe(true);
  expect(fs.stat(temporary)).rejects.toThrow("ENOENT");
});
