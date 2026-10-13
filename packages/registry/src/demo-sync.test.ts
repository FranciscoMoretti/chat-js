import { afterEach, expect, spyOn, test } from "bun:test";
import { rejects } from "node:assert/strict";
import fs, {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { generateDemo, syncDemo } from "../scripts/demo-sync";
import { jsonObject, parseJsonObject } from "./test-json";
import {
  observeGeneratorFailure,
  prepareReplacement,
  replacementFailure,
  verifyRollback,
} from "./demo-sync-test-support";

import type { ReadonlyNativeSurface } from "./demo-sync-test-support";

import path from "node:path";
import { tmpdir } from "node:os";

const FIRST_DIRECTORY_INDEX = 0;
const GENERATION_TIMEOUT_MS = 60_000;
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

test.each(["mkdir", "mkdtemp", "writeFile"])(
  "failed staging %s drains allocated writes before cleanup and preserves destinations",
  async (failure) => {
    const options = await fixture();
    const previous = await readFile(options.baseline, "utf-8");
    options.expected.set("implementation.ts", "// updated canonical\n");
    for (const file of ["a.ts", "b.ts", "c.ts"]) {
      options.expected.set(file, "// new canonical\n");
    }
    const originalWrite = fs.writeFile;
    const originalRemove = fs.rm;
    const gate = Promise.withResolvers<boolean>();
    const admitted = Promise.withResolvers<boolean>();
    let failed = false;
    let heldWrites = 0;
    const inject = (operation: string): void => {
      if (!failed && failure === operation) {
        failed = true;
        throw new Error("Injected staging failure");
      }
    };
    const createParent = spyOn(fs, "mkdir");
    const allocate = spyOn(fs, "mkdtemp");
    if (failure === "mkdir") {
      createParent.mockRejectedValueOnce(new Error("Injected staging failure"));
    }
    if (failure === "mkdtemp") {
      allocate.mockRejectedValueOnce(new Error("Injected staging failure"));
    }
    const write = spyOn(fs, "writeFile").mockImplementation(
      async (...args: Parameters<typeof fs.writeFile>) => {
        inject("writeFile");
        heldWrites += 1;
        if (heldWrites === 3) {
          admitted.resolve(true);
        }
        await gate.promise;
        await originalWrite(...args);
      }
    );
    const remove = spyOn(fs, "rm").mockImplementation(
      async (...args: Parameters<typeof fs.rm>) => {
        await originalRemove(...args);
      }
    );
    const rename = spyOn(fs, "rename");
    const syncing = syncDemo(options);
    const rejected = rejects(syncing, /Injected staging failure/u);
    try {
      await admitted.promise;
      expect(heldWrites).toBe(3);
      expect(rename).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
      gate.resolve(true);
      await rejected;
      expect(await readFile(options.baseline, "utf-8")).toBe(previous);
      expect(
        await readFile(path.join(options.root, "implementation.ts"), "utf-8")
      ).toBe("// canonical\nexport type Result = string;\n");
      const entries = await fs.readdir(options.root);
      expect(
        entries.filter(
          (file) =>
            file.startsWith(".demo-sync-") ||
            ["a.ts", "b.ts", "c.ts"].includes(file)
        )
      ).toEqual([]);
    } finally {
      gate.resolve(true);
      createParent.mockRestore();
      allocate.mockRestore();
      write.mockRestore();
      remove.mockRestore();
      rename.mockRestore();
      await rejected;
    }
  }
);

test("staging is bounded and commits source order with the baseline last", async () => {
  const options = await fixture();
  const files = ["a.ts", "b.ts", "c.ts", "implementation.ts"];
  for (const file of files) {
    options.expected.set(file, "// updated canonical\n");
  }
  const gates = Array.from({ length: 5 }, () =>
    Promise.withResolvers<boolean>()
  );
  const firstBatch = Promise.withResolvers<boolean>();
  const lastBatch = Promise.withResolvers<boolean>();
  const originalWrite = fs.writeFile;
  const originalRename = fs.rename;
  let writes = 0;
  const committed: string[] = [];
  const write = spyOn(fs, "writeFile").mockImplementation(
    async (...args: Parameters<typeof fs.writeFile>) => {
      const index = writes;
      writes += 1;
      if (writes === 4) {
        firstBatch.resolve(true);
      }
      if (writes === 5) {
        lastBatch.resolve(true);
      }
      await gates[index].promise;
      await originalWrite(...args);
    }
  );
  const rename = spyOn(fs, "rename").mockImplementation(
    async (...args: Parameters<typeof fs.rename>) => {
      if (path.basename(String(args[0])) === "next") {
        committed.push(String(args[1]));
      }
      await originalRename(...args);
    }
  );
  const syncing = syncDemo(options);
  try {
    await firstBatch.promise;
    for (const gate of gates.slice(1, 4).toReversed()) {
      gate.resolve(true);
    }
    await Promise.resolve();
    expect(writes).toBe(4);
    expect(committed).toEqual([]);
    gates[0].resolve(true);
    await lastBatch.promise;
    expect(committed).toEqual([]);
    gates[4].resolve(true);
    await syncing;
    expect(committed).toEqual([
      ...files.map((file) => path.join(options.root, file)),
      options.baseline,
    ]);
  } finally {
    for (const gate of gates) {
      gate.resolve(true);
    }
    await syncing;
    write.mockRestore();
    rename.mockRestore();
  }
});
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

test(
  "demo generation preserves canonical import order and directive attachment",
  async () => {
    const generated = await generateDemo();
    await Promise.all(
      [
        {
          source: "./features/mcp/lib/eve/mcp-tools.ts",
          target: "lib/eve/mcp-tools.ts",
        },
        {
          source: "./features/vercel-speed-insights/component.tsx",
          target: "features/vercel-speed-insights/component.tsx",
        },
      ].map(
        async ({
          source,
          target,
        }: Readonly<{ source: string; target: string }>) => {
          const canonical = await readFile(
            new URL(source, import.meta.url),
            "utf-8"
          );
          expect(generated.get(target)).toBe(canonical);
        }
      )
    );
  },
  GENERATION_TIMEOUT_MS
);
